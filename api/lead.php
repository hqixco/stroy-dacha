<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

const LEAD_ERROR_MESSAGE = 'Не удалось отправить заявку. Повторите попытку или свяжитесь с нами по телефону.';
const TELEGRAM_TIMEOUT_SECONDS = 12;
const DEFAULT_LEAD_EMAIL_TO = 'replace-me@example.com';
const DEFAULT_LEAD_EMAIL_FROM = 'no-reply@example.com';

function lead_json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lead_normalize_whitespace($value): string
{
    if (is_array($value)) {
        $value = implode(', ', array_map('lead_normalize_whitespace', $value));
    }

    $value = (string)($value ?? '');
    $value = preg_replace('/\s+/u', ' ', $value);

    return trim($value ?? '');
}

function lead_field_limits(): array
{
    return [
        'name' => 120,
        'phone' => 40,
        'email' => 160,
        'city' => 160,
        'service' => 200,
        'task_type' => 200,
        'roof_area' => 120,
        'message' => 4000,
        'comment' => 4000,
        'form_name' => 200,
        'page' => 500,
        'page_url' => 1000,
        'website' => 200,
        'utm_source' => 120,
        'utm_medium' => 120,
        'utm_campaign' => 180,
        'utm_content' => 180,
        'utm_term' => 180,
        'yclid' => 180,
        'contact_method' => 80,
        'source_id' => 200,
        'submitted_at' => 80,
        'attachment_name' => 1200,
    ];
}

function lead_sanitize_value(string $key, $value): string
{
    $limits = lead_field_limits();
    $limit = $limits[$key] ?? 500;

    return substr(lead_normalize_whitespace($value), 0, $limit);
}

function lead_error_payload(string $details = ''): array
{
    $details = lead_sanitize_value('message', $details);

    return [
        'success' => false,
        'message' => $details !== '' ? LEAD_ERROR_MESSAGE . ' [' . $details . ']' : LEAD_ERROR_MESSAGE,
    ];
}

function lead_request_id(): string
{
    try {
        return bin2hex(random_bytes(8));
    } catch (Throwable $error) {
        return substr(sha1(uniqid('', true)), 0, 16);
    }
}

function lead_log_file_path(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'lead.log';
}

function lead_log_context_value($value)
{
    if (is_array($value)) {
        $normalized = [];
        foreach ($value as $key => $item) {
            $normalized[(string)$key] = lead_log_context_value($item);
        }

        return $normalized;
    }

    if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
        return $value;
    }

    return lead_normalize_whitespace((string)$value);
}

function lead_log(string $requestId, string $stage, array $context = []): void
{
    $payload = [
        'ts' => gmdate('c'),
        'request_id' => $requestId,
        'stage' => $stage,
    ];

    foreach ($context as $key => $value) {
        $payload[(string)$key] = lead_log_context_value($value);
    }

    $line = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($line) || $line === '') {
        $line = '{"ts":"' . gmdate('c') . '","request_id":"' . $requestId . '","stage":"log_encode_failed"}';
    }

    error_log('[lead.php] ' . $line);

    $logFile = lead_log_file_path();
    $logDir = dirname($logFile);

    if (!is_dir($logDir)) {
        @mkdir($logDir, 0775, true);
    }

    @file_put_contents($logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function lead_escape_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function lead_lower(string $value): string
{
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($value, 'UTF-8');
    }

    return strtolower($value);
}

function lead_load_dotenv(string $filePath): void
{
    if (!is_file($filePath) || !is_readable($filePath)) {
        return;
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $rawLine) {
        $line = trim((string)$rawLine);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }

        $separatorIndex = strpos($line, '=');
        if ($separatorIndex === false || $separatorIndex <= 0) {
            continue;
        }

        $key = trim(substr($line, 0, $separatorIndex));
        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        $value = trim(substr($line, $separatorIndex + 1));
        $valueLength = strlen($value);

        if ($valueLength >= 2) {
            $firstChar = $value[0];
            $lastChar = $value[$valueLength - 1];
            if (($firstChar === '"' && $lastChar === '"') || ($firstChar === "'" && $lastChar === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

function lead_load_config(): array
{
    $baseDir = __DIR__;
    $dotenvCandidates = [
        dirname($baseDir) . DIRECTORY_SEPARATOR . '.env',
        dirname($baseDir) . DIRECTORY_SEPARATOR . '.env.local',
        dirname(dirname($baseDir)) . DIRECTORY_SEPARATOR . '.env',
        dirname(dirname($baseDir)) . DIRECTORY_SEPARATOR . '.env.local',
    ];

    foreach ($dotenvCandidates as $dotenvPath) {
        lead_load_dotenv($dotenvPath);
    }

    $config = [];
    $configFile = $baseDir . DIRECTORY_SEPARATOR . 'lead-config.php';
    if (is_file($configFile)) {
        $loaded = require $configFile;
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }

    return [
        'bot_token' => lead_normalize_whitespace($config['BOT_TOKEN'] ?? getenv('BOT_TOKEN') ?: ''),
        'chat_id' => lead_normalize_whitespace($config['CHAT_ID'] ?? getenv('CHAT_ID') ?: ''),
        'lead_email_to' => lead_normalize_whitespace($config['LEAD_EMAIL_TO'] ?? getenv('LEAD_EMAIL_TO') ?: DEFAULT_LEAD_EMAIL_TO),
        'lead_email_from' => lead_normalize_whitespace($config['LEAD_EMAIL_FROM'] ?? getenv('LEAD_EMAIL_FROM') ?: DEFAULT_LEAD_EMAIL_FROM),
    ];
}

function lead_is_valid_email(string $email): bool
{
    return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function lead_is_likely_phone(string $phone): bool
{
    if ($phone === '') {
        return false;
    }

    $digits = preg_replace('/\D+/', '', $phone);
    $digits = is_string($digits) ? $digits : '';

    return strlen($digits) >= 10 && strlen($digits) <= 15;
}

function lead_normalize_quiz_answers($rawValue): array
{
    if (is_string($rawValue)) {
        $decoded = json_decode($rawValue, true);
        $rawValue = is_array($decoded) ? $decoded : [];
    }

    if (!is_array($rawValue)) {
        return [];
    }

    $answers = [];
    foreach ($rawValue as $item) {
        if (!is_array($item)) {
            continue;
        }

        $question = lead_sanitize_value('message', $item['question'] ?? '');
        $answerRaw = $item['answer'] ?? '';
        $answer = is_array($answerRaw)
            ? array_values(array_filter(array_map(static function ($value) {
                return substr(lead_normalize_whitespace($value), 0, 300);
            }, $answerRaw)))
            : lead_sanitize_value('message', $answerRaw);

        if ($question === '') {
            continue;
        }

        if (is_array($answer) && count($answer) === 0) {
            continue;
        }

        if (!is_array($answer) && $answer === '') {
            continue;
        }

        $answers[] = [
            'question' => $question,
            'answer' => $answer,
        ];
    }

    return $answers;
}

function lead_normalize_payload(array $input): array
{
    $payload = [];

    foreach (lead_field_limits() as $key => $limit) {
        $payload[$key] = lead_sanitize_value($key, $input[$key] ?? '');
    }

    $payload['quiz_answers'] = lead_normalize_quiz_answers($input['quiz_answers'] ?? []);

    return $payload;
}

function lead_collect_files(array $files): array
{
    $result = [];

    foreach ($files as $fieldName => $fileInfo) {
        if (!is_array($fileInfo) || !isset($fileInfo['error'])) {
            continue;
        }

        $isMulti = is_array($fileInfo['error']);
        $errors = $isMulti ? $fileInfo['error'] : [$fileInfo['error']];
        $names = $isMulti ? (array)$fileInfo['name'] : [$fileInfo['name']];
        $tmpNames = $isMulti ? (array)$fileInfo['tmp_name'] : [$fileInfo['tmp_name']];
        $sizes = $isMulti ? (array)$fileInfo['size'] : [$fileInfo['size']];
        $types = $isMulti ? (array)$fileInfo['type'] : [$fileInfo['type']];

        foreach ($errors as $index => $errorCode) {
            if ((int)$errorCode === UPLOAD_ERR_NO_FILE) {
                continue;
            }

            if ((int)$errorCode !== UPLOAD_ERR_OK) {
                throw new RuntimeException('Ошибка загрузки файла: код ' . (int)$errorCode);
            }

            $tmpName = (string)($tmpNames[$index] ?? '');
            if ($tmpName === '' || !is_uploaded_file($tmpName)) {
                throw new RuntimeException('Файл не был корректно загружен');
            }

            $result[] = [
                'field_name' => lead_sanitize_value('source_id', (string)$fieldName),
                'name' => lead_sanitize_value('attachment_name', (string)($names[$index] ?? 'attachment')),
                'tmp_name' => $tmpName,
                'size' => (int)($sizes[$index] ?? 0),
                'type' => lead_sanitize_value('source_id', (string)($types[$index] ?? 'application/octet-stream')),
            ];
        }
    }

    return $result;
}

function lead_parse_request_payload(): array
{
    $contentType = lead_lower(lead_normalize_whitespace($_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '')));

    if (strpos($contentType, 'application/json') !== false) {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false) {
            throw new RuntimeException('Не удалось прочитать тело запроса');
        }

        $decoded = json_decode($rawBody, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Некорректный JSON');
        }

        return [$decoded, []];
    }

    return [$_POST, lead_collect_files($_FILES)];
}

function lead_validate_payload(array $payload): ?string
{
    $hasPhone = lead_is_likely_phone($payload['phone']);
    $hasEmail = lead_is_valid_email($payload['email']);

    if ($payload['form_name'] === '') {
        return 'Не указана форма';
    }

    if ($payload['page'] === '') {
        return 'Не указана страница';
    }

    if (!$hasPhone && !$hasEmail) {
        return 'Нужен телефон или email';
    }

    if ($payload['email'] !== '' && !$hasEmail) {
        return 'Некорректный email';
    }

    if ($payload['phone'] !== '' && !$hasPhone) {
        return 'Некорректный телефон';
    }

    return null;
}

function lead_add_message_line(array &$lines, string $label, string $value): void
{
    if ($value === '') {
        return;
    }

    $lines[] = '<b>' . lead_escape_html($label) . ':</b> ' . lead_escape_html($value);
}

function lead_build_message(array $payload): string
{
    $lines = ['<b>Новая заявка с сайта</b>', ''];

    lead_add_message_line($lines, 'Форма', $payload['form_name']);
    lead_add_message_line($lines, 'Имя', $payload['name']);
    lead_add_message_line($lines, 'Телефон', $payload['phone']);
    lead_add_message_line($lines, 'Email', $payload['email']);
    lead_add_message_line($lines, 'Город', $payload['city']);
    lead_add_message_line($lines, 'Услуга', $payload['service']);
    lead_add_message_line($lines, 'Задача', $payload['task_type']);
    lead_add_message_line($lines, 'Площадь', $payload['roof_area']);
    lead_add_message_line($lines, 'Способ связи', $payload['contact_method']);
    lead_add_message_line($lines, 'Комментарий', $payload['comment']);
    lead_add_message_line($lines, 'Сообщение', $payload['message']);
    lead_add_message_line($lines, 'Источник формы', $payload['source_id']);
    lead_add_message_line($lines, 'Файл', $payload['attachment_name']);

    if (!empty($payload['quiz_answers'])) {
        $lines[] = '';
        $lines[] = '<b>Ответы квиза:</b>';

        foreach ($payload['quiz_answers'] as $item) {
            $answer = is_array($item['answer']) ? implode(', ', $item['answer']) : (string)$item['answer'];
            lead_add_message_line($lines, (string)$item['question'], $answer);
        }
    }

    $lines[] = '';
    lead_add_message_line($lines, 'Страница', $payload['page']);
    lead_add_message_line($lines, 'URL', $payload['page_url']);

    $sourceParts = array_values(array_filter([$payload['utm_source'], $payload['utm_medium']]));
    if (!empty($sourceParts)) {
        lead_add_message_line($lines, 'Источник', implode(' / ', $sourceParts));
    }

    lead_add_message_line($lines, 'Кампания', $payload['utm_campaign']);
    lead_add_message_line($lines, 'Контент', $payload['utm_content']);
    lead_add_message_line($lines, 'Ключ', $payload['utm_term']);
    lead_add_message_line($lines, 'yclid', $payload['yclid']);
    lead_add_message_line($lines, 'Отправлено', $payload['submitted_at']);

    $lines[] = '';
    lead_add_message_line($lines, 'Дата сервера', date('d.m.Y H:i:s'));

    return implode("\n", $lines);
}

function lead_build_email_message(array $payload): string
{
    $message = lead_build_message($payload);
    $message = preg_replace('/<br\s*\/?>/i', "\n", $message);
    $message = strip_tags((string)$message);
    $message = html_entity_decode($message, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $message = preg_replace("/\n{3,}/", "\n\n", (string)$message);

    return trim((string)$message);
}

function lead_sanitize_email_header(string $value): string
{
    return str_replace(["\r", "\n"], ' ', lead_normalize_whitespace($value));
}

function lead_encode_email_subject(string $subject): string
{
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

function lead_parse_response_headers(array $headers): array
{
    $parsed = [];

    foreach ($headers as $headerLine) {
        $separatorPos = strpos((string)$headerLine, ':');
        if ($separatorPos === false) {
            continue;
        }

        $name = strtolower(trim(substr((string)$headerLine, 0, $separatorPos)));
        $value = trim(substr((string)$headerLine, $separatorPos + 1));
        if ($name !== '') {
            $parsed[$name] = $value;
        }
    }

    return $parsed;
}

function lead_build_multipart_body(array $fields, string $boundary): string
{
    $eol = "\r\n";
    $body = '';

    foreach ($fields as $name => $value) {
        $body .= '--' . $boundary . $eol;

        if (is_array($value) && isset($value['file_path'])) {
            $filename = str_replace(['"', "\r", "\n"], ['_', '', ''], (string)($value['filename'] ?? 'attachment'));
            $mimeType = lead_normalize_whitespace((string)($value['mime_type'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
            $fileContent = @file_get_contents((string)$value['file_path']);

            if ($fileContent === false) {
                throw new RuntimeException('Не удалось прочитать файл для отправки');
            }

            $body .= 'Content-Disposition: form-data; name="' . $name . '"; filename="' . $filename . '"' . $eol;
            $body .= 'Content-Type: ' . $mimeType . $eol . $eol;
            $body .= $fileContent . $eol;
            continue;
        }

        $body .= 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol;
        $body .= (string)$value . $eol;
    }

    return $body . '--' . $boundary . '--' . $eol;
}

function lead_stream_telegram_request(string $botToken, string $method, array $fields): array
{
    $url = 'https://api.telegram.org/bot' . rawurlencode($botToken) . '/' . $method;
    $hasFile = false;

    foreach ($fields as $value) {
        if (is_array($value) && isset($value['file_path'])) {
            $hasFile = true;
            break;
        }
    }

    if ($hasFile) {
        $boundary = '----lead' . md5(uniqid('', true));
        $body = lead_build_multipart_body($fields, $boundary);
        $headers = [
            'Content-Type: multipart/form-data; boundary=' . $boundary,
            'Content-Length: ' . strlen($body),
            'Connection: close',
        ];
    } else {
        $body = http_build_query($fields, '', '&', PHP_QUERY_RFC3986);
        $headers = [
            'Content-Type: application/x-www-form-urlencoded',
            'Content-Length: ' . strlen($body),
            'Connection: close',
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'timeout' => TELEGRAM_TIMEOUT_SECONDS,
            'ignore_errors' => true,
        ],
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $responseHeaders = isset($http_response_header) && is_array($http_response_header) ? $http_response_header : [];
    $statusLine = $responseHeaders[0] ?? '';
    $statusCode = preg_match('/\s(\d{3})\s/', $statusLine, $matches) ? (int)$matches[1] : 0;

    if ($responseBody === false) {
        $headerMap = lead_parse_response_headers($responseHeaders);
        $transportError = $headerMap['x-php-warning'] ?? 'Ошибка HTTP transport';
        throw new RuntimeException($transportError);
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Telegram вернул некорректный ответ');
    }

    if ($statusCode < 200 || $statusCode >= 300 || ($decoded['ok'] ?? false) !== true) {
        $description = lead_sanitize_value('message', (string)($decoded['description'] ?? ('HTTP ' . $statusCode)));
        throw new RuntimeException($description !== '' ? $description : 'Ошибка Telegram API');
    }

    return $decoded;
}

function lead_telegram_request(string $botToken, string $method, array $fields): array
{
    if (!function_exists('curl_init')) {
        return lead_stream_telegram_request($botToken, $method, $fields);
    }

    $url = 'https://api.telegram.org/bot' . rawurlencode($botToken) . '/' . $method;
    $ch = curl_init($url);

    if ($ch === false) {
        throw new RuntimeException('Не удалось инициализировать cURL');
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => TELEGRAM_TIMEOUT_SECONDS,
        CURLOPT_TIMEOUT => TELEGRAM_TIMEOUT_SECONDS,
        CURLOPT_HTTPHEADER => ['Expect:'],
    ]);

    $responseBody = curl_exec($ch);
    $curlError = curl_error($ch);
    $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($responseBody === false) {
        throw new RuntimeException($curlError !== '' ? $curlError : 'Ошибка cURL');
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Telegram вернул некорректный ответ');
    }

    if ($statusCode < 200 || $statusCode >= 300 || ($decoded['ok'] ?? false) !== true) {
        $description = lead_sanitize_value('message', (string)($decoded['description'] ?? ('HTTP ' . $statusCode)));
        throw new RuntimeException($description !== '' ? $description : 'Ошибка Telegram API');
    }

    return $decoded;
}

function lead_send_message(array $payload, array $config): void
{
    lead_telegram_request($config['bot_token'], 'sendMessage', [
        'chat_id' => $config['chat_id'],
        'text' => lead_build_message($payload),
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => 'true',
    ]);
}

function lead_send_documents(array $payload, array $files, array $config): void
{
    if (empty($files)) {
        return;
    }

    foreach ($files as $file) {
        $captionParts = array_values(array_filter([
            $payload['form_name'] !== '' ? 'Форма: ' . $payload['form_name'] : '',
            $payload['page'] !== '' ? 'Страница: ' . $payload['page'] : '',
            $file['field_name'] !== '' ? 'Поле: ' . $file['field_name'] : '',
        ]));

        $fields = [
            'chat_id' => $config['chat_id'],
        ];

        if (function_exists('curl_file_create')) {
            $fields['document'] = curl_file_create($file['tmp_name'], $file['type'] ?: 'application/octet-stream', $file['name']);
        } else {
            $fields['document'] = [
                'file_path' => $file['tmp_name'],
                'filename' => $file['name'],
                'mime_type' => $file['type'] ?: 'application/octet-stream',
            ];
        }

        if (!empty($captionParts)) {
            $fields['caption'] = substr(implode("\n", $captionParts), 0, 1024);
        }

        lead_telegram_request($config['bot_token'], 'sendDocument', $fields);
    }
}

function lead_send_email_copy(array $payload, array $config): bool
{
    $to = lead_sanitize_email_header($config['lead_email_to'] ?? DEFAULT_LEAD_EMAIL_TO);
    if ($to === '') {
        return false;
    }

    $from = lead_sanitize_email_header($config['lead_email_from'] ?? DEFAULT_LEAD_EMAIL_FROM);
    $subject = lead_encode_email_subject('Новая заявка с сайта: ' . ($payload['form_name'] !== '' ? $payload['form_name'] : 'форма'));
    $body = lead_build_email_message($payload);
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'From: ' . $from,
        'Reply-To: ' . ($payload['email'] !== '' ? lead_sanitize_email_header($payload['email']) : $from),
    ];

    return @mail($to, $subject, $body, implode("\r\n", $headers));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    lead_json_response(405, lead_error_payload('Method not allowed'));
}

$requestId = lead_request_id();
$contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$forwardedFor = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';

lead_log($requestId, 'request_started', [
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'content_type' => $contentType,
    'origin' => $origin,
    'remote_addr' => $remoteAddr,
    'forwarded_for' => $forwardedFor,
    'post_keys' => array_keys($_POST),
    'file_keys' => array_keys($_FILES),
]);

$config = lead_load_config();
if ($config['bot_token'] === '' || $config['chat_id'] === '') {
    lead_log($requestId, 'config_missing', [
        'has_bot_token' => $config['bot_token'] !== '',
        'has_chat_id' => $config['chat_id'] !== '',
        'api_dir' => __DIR__,
    ]);
    lead_json_response(500, lead_error_payload('Missing BOT_TOKEN or CHAT_ID'));
}

try {
    [$requestData, $files] = lead_parse_request_payload();
    $payload = lead_normalize_payload($requestData);
} catch (Throwable $error) {
    lead_log($requestId, 'request_parse_failed', [
        'error' => $error->getMessage(),
    ]);
    lead_json_response(400, lead_error_payload($error->getMessage()));
}

lead_log($requestId, 'request_parsed', [
    'form_name' => $payload['form_name'],
    'page' => $payload['page'],
    'has_phone' => $payload['phone'] !== '',
    'has_email' => $payload['email'] !== '',
    'files_count' => count($files),
]);

if ($payload['attachment_name'] === '' && !empty($files)) {
    $payload['attachment_name'] = lead_sanitize_value(
        'attachment_name',
        implode(', ', array_map(static function (array $file): string {
            return $file['name'];
        }, $files))
    );
}

if ($payload['website'] !== '') {
    lead_log($requestId, 'honeypot_triggered', [
        'form_name' => $payload['form_name'],
    ]);
    lead_json_response(200, [
        'success' => true,
        'message' => 'Заявка отправлена',
    ]);
}

$validationError = lead_validate_payload($payload);
if ($validationError !== null) {
    lead_log($requestId, 'validation_failed', [
        'form_name' => $payload['form_name'],
        'page' => $payload['page'],
        'error' => $validationError,
    ]);
    lead_json_response(422, lead_error_payload($validationError));
}

try {
    lead_log($requestId, 'telegram_send_started', [
        'form_name' => $payload['form_name'],
        'files_count' => count($files),
        'transport' => function_exists('curl_init') ? 'curl' : 'stream',
    ]);
    lead_send_message($payload, $config);
    lead_send_documents($payload, $files, $config);

    $emailSent = lead_send_email_copy($payload, $config);
    lead_log($requestId, $emailSent ? 'email_send_succeeded' : 'email_send_failed', [
        'form_name' => $payload['form_name'],
        'to' => $config['lead_email_to'] ?? DEFAULT_LEAD_EMAIL_TO,
    ]);

    lead_log($requestId, 'telegram_send_succeeded', [
        'form_name' => $payload['form_name'],
    ]);

    lead_json_response(200, [
        'success' => true,
        'message' => 'Заявка отправлена',
    ]);
} catch (Throwable $error) {
    lead_log($requestId, 'telegram_send_failed', [
        'form_name' => $payload['form_name'],
        'page' => $payload['page'],
        'error' => $error->getMessage(),
        'transport' => function_exists('curl_init') ? 'curl' : 'stream',
    ]);
    lead_json_response(502, lead_error_payload($error->getMessage()));
}
