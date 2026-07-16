import './styles.css';
import { companyData } from './data/company.js';
import { projects } from './data/projects.js';
import { calculatorSteps } from './data/calculator.js';
import quizConsultationImage from './assets/quiz-consultation.png';
import quizNewRoofImage from './assets/quiz-new-roof.png';
import quizRepairRebuildImage from './assets/quiz-repair-rebuild.png';
import quizReplacementRoofImage from './assets/quiz-replacement-roof.png';
import heroUploadImage from './assets/header-photo-estimate.png';

const pageUrl = new URL(window.location.href);
const queryParams = pageUrl.searchParams;
const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];
const LEAD_ENDPOINT = '/api/lead.php';
const METRIKA_COUNTER_ID = 110763617;
const METRIKA_FORM_GOAL = 'form_submit';

const calculatorState = {
  currentStep: 0,
  answers: {},
  autoAdvanceTimeout: null,
};

const projectGalleryState = {
  projectIndex: 0,
  imageIndex: 0,
};

const roots = {
  projects: document.querySelector('#projects-list'),
  calculatorStep: document.querySelector('#calculator-step'),
  calculatorProgress: document.querySelector('#calculator-progress'),
  calculatorForm: document.querySelector('#calculator-form'),
  calculatorCounter: document.querySelector('#calculator-counter'),
  calculatorPrev: document.querySelector('#calculator-prev'),
  calculatorNext: document.querySelector('#calculator-next'),
  leadForm: document.querySelector('#lead-form'),
  auditForm: document.querySelector('#audit-form'),
  modal: document.querySelector('#project-modal'),
  modalContent: document.querySelector('#project-modal-content'),
};

function trackEvent(eventName, payload = {}) {
  const eventPayload = {
    event: eventName,
    page: window.location.pathname,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(eventPayload);

  window.dispatchEvent(new CustomEvent('stroydacha:analytics', { detail: eventPayload }));
}

function trackFormGoal(payload = {}) {
  if (typeof window.ym === 'function') {
    window.ym(METRIKA_COUNTER_ID, 'reachGoal', METRIKA_FORM_GOAL, payload);
  }
}

function clearCalculatorAutoAdvance() {
  if (calculatorState.autoAdvanceTimeout) {
    window.clearTimeout(calculatorState.autoAdvanceTimeout);
    calculatorState.autoAdvanceTimeout = null;
  }
}

function applyCompanyData() {
  const metaRegion = document.querySelector('#meta-region');
  const metaRadius = document.querySelector('#meta-radius');
  const metaFree = document.querySelector('#meta-free');
  const metaHours = document.querySelector('#meta-hours');
  const footerCoverage = document.querySelector('#footer-coverage');
  const metaTelegram = document.querySelector('#meta-telegram');
  const metaTelegramLabel = metaTelegram?.querySelector('.meta-bar__telegram-label');
  const headerTelegram = document.querySelector('#header-telegram');
  const footerTelegram = document.querySelector('#footer-telegram');
  const headerPhone = document.querySelector('#header-phone');
  const headerPhoneText = document.querySelector('#header-phone .header-bar__phone-text');
  const footerPhone = document.querySelector('#footer-phone');
  const footerEmail = document.querySelector('#footer-email');
  const footerSchedule = document.querySelector('#footer-schedule');

  if (metaRegion) metaRegion.textContent = 'Москва и МО';
  if (metaRadius) metaRadius.textContent = 'выезд до 350 км от МКАД';
  if (metaFree) metaFree.textContent = 'замер и расчёт бесплатно';
  if (metaHours) metaHours.textContent = 'Пн–Вс 9:00–21:00';
  if (footerCoverage) {
    footerCoverage.textContent = `${companyData.mainRegion}. Выезд на удалённые объекты до 350 км согласовывается отдельно.`;
  }

  if (metaTelegram) metaTelegram.href = companyData.telegram;
  if (metaTelegramLabel) metaTelegramLabel.textContent = 'Написать в Telegram';
  if (headerTelegram) headerTelegram.href = companyData.telegram;
  if (footerTelegram) footerTelegram.href = companyData.telegram;
  if (headerPhoneText) headerPhoneText.textContent = companyData.phone;
  if (headerPhone) headerPhone.href = companyData.phoneHref;
  if (footerPhone) {
    footerPhone.textContent = companyData.phone;
    footerPhone.href = companyData.phoneHref;
  }
  if (footerEmail) {
    footerEmail.textContent = companyData.email;
    footerEmail.href = `mailto:${companyData.email}`;
  }
  if (footerSchedule) {
    footerSchedule.innerHTML = `${companyData.city}<br>${companyData.workingHours.weekdays}<br>${companyData.workingHours.sunday}`;
  }
}

function renderCalculatorStep() {
  if (
    !roots.calculatorStep ||
    !roots.calculatorCounter ||
    !roots.calculatorProgress ||
    !roots.calculatorPrev ||
    !roots.calculatorNext
  ) {
    return;
  }

  const step = calculatorSteps[calculatorState.currentStep];
  const isFinal = step.type === 'fields';
  const totalSteps = calculatorSteps.length;

  roots.calculatorCounter.innerHTML = `
    <span class="calculator__counter-text">Шаг ${calculatorState.currentStep + 1} из ${totalSteps}</span>
    <span class="calculator__counter-bars">
      ${calculatorSteps
        .map(
          (_, index) =>
            `<span class="calculator__counter-bar ${index === calculatorState.currentStep ? 'is-active' : ''} ${index < calculatorState.currentStep ? 'is-complete' : ''}"></span>`,
        )
        .join('')}
    </span>
  `;

  roots.calculatorProgress.innerHTML = calculatorSteps
    .map(
      (item, index) => `
        <span class="calculator__progress-item ${index === calculatorState.currentStep ? 'is-active' : ''} ${index < calculatorState.currentStep ? 'is-complete' : ''}">
          ${index + 1}. ${item.shortTitle}
        </span>
      `,
    )
    .join('');

  if (!isFinal) {
    roots.calculatorStep.innerHTML = `
      <div class="calculator__step-head">
        <h3 class="calculator__step-title">${step.title}</h3>
      </div>
      <div class="option-grid ${step.id === 'task_type' ? 'option-grid--task-type' : ''}">
        ${step.options
          .map(
            (option, index) => `
              <label class="option-card ${calculatorState.answers[step.id] === option ? 'is-selected' : ''} ${index === 0 ? 'is-priority' : ''}">
                <input
                  class="option-card__input"
                  type="radio"
                  name="${step.id}"
                  value="${option}"
                  ${calculatorState.answers[step.id] === option ? 'checked' : ''}
                />
                <span class="option-card__icon" aria-hidden="true">${getCalculatorOptionIcon(step.id, option)}</span>
                <span class="option-card__title">${option}</span>
                <span class="option-card__check" aria-hidden="true">✓</span>
              </label>
            `,
          )
          .join('')}
      </div>
    `;
  } else {
    roots.calculatorStep.innerHTML = `
      <div class="calculator__step-head calculator__step-head--final">
        <h3 class="calculator__step-title">${step.title}</h3>
        <p class="calculator__step-text calculator__step-text--final">${step.description}</p>
      </div>
      <div class="calculator__final-form">
        <div class="form-shell__row calculator__final-row">
          <label class="field calculator__field">
            <span class="field__label">Имя</span>
            <input class="field__control calculator__control" type="text" name="name" autocomplete="name" placeholder="Как к вам обращаться" />
          </label>
          <label class="field calculator__field calculator__field--primary">
            <span class="field__label">Телефон</span>
            <input class="field__control calculator__control" type="tel" name="phone" autocomplete="tel" placeholder="+7 (___) ___-__-__" required />
          </label>
        </div>
        <div class="calculator__upload-wrap">
          <label class="upload-field upload-field--compact calculator__upload">
            <input class="upload-field__input" type="file" name="projectFile" />
            <span class="calculator__upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3 7 8l1.4 1.4 2.6-2.6V16h2V6.8l2.6 2.6L17 8l-5-5ZM5 18h14v2H5v-2Z"/></svg>
            </span>
            <span class="calculator__upload-body">
              <span class="upload-field__title">Прикрепить проект, фото или смету</span>
              <span class="upload-field__hint">Необязательно, но так расчёт будет точнее</span>
            </span>
            <span class="calculator__upload-tag">PDF / JPG / PNG</span>
          </label>
        </div>
      </div>
      <p class="calculator__final-note">Уточним покрытие и сложные узлы по телефону перед подготовкой сметы</p>
      `;
  }

  roots.calculatorPrev.disabled = calculatorState.currentStep === 0;
  roots.calculatorNext.textContent = isFinal ? 'Получить расчет' : 'Далее';
}

function getCalculatorOptionIcon(stepId, option) {
  if (stepId !== 'task_type') {
    return `<span class="option-card__icon-dot"></span>`;
  }

  const icons = {
    'Монтаж новой кровли': `<img class="option-card__icon-image" src="${quizNewRoofImage}" alt="" loading="lazy" />`,
    'Полная замена кровли': `<img class="option-card__icon-image" src="${quizReplacementRoofImage}" alt="" loading="lazy" />`,
    'Ремонт или реконструкция': `<img class="option-card__icon-image" src="${quizRepairRebuildImage}" alt="" loading="lazy" />`,
    'Нужна консультация': `<img class="option-card__icon-image" src="${quizConsultationImage}" alt="" loading="lazy" />`,
  };

  return icons[option] || `<span class="option-card__icon-dot"></span>`;
}

function getSelectedCalculatorValue(stepId) {
  const stateValue = calculatorState.answers[stepId];

  if (stateValue) {
    return stateValue;
  }

  if (!roots.calculatorStep) {
    return '';
  }

  const checked = roots.calculatorStep.querySelector(`input[name="${stepId}"]:checked`);
  return checked ? checked.value : '';
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 11;
}

function appendTrackingFields(form, extraPayload = {}) {
  const fields = {
    page_url: window.location.href,
    submitted_at: new Date().toISOString(),
    ...Object.fromEntries(trackingKeys.map((key) => [key, queryParams.get(key) || ''])),
    ...extraPayload,
  };

  Object.entries(fields).forEach(([name, value]) => {
    let input = form.querySelector(`input[type="hidden"][name="${name}"]`);

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }

    input.value = typeof value === 'string' ? value : JSON.stringify(value);
  });
}

function getFormPayload(form, extraPayload = {}) {
  const formData = new FormData(form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  return {
    ...payload,
    ...Object.fromEntries(trackingKeys.map((key) => [key, queryParams.get(key) || ''])),
    page_url: window.location.href,
    submitted_at: new Date().toISOString(),
    ...extraPayload,
  };
}

function getFormName(form, fallbackEventName) {
  if (form === roots.calculatorForm) {
    return 'Калькулятор';
  }

  if (form === roots.auditForm) {
    return 'Проверка сметы';
  }

  if (form === roots.leadForm) {
    return 'Получить расчёт';
  }

  return fallbackEventName;
}

function buildQuizAnswers() {
  return calculatorSteps
    .filter((step) => step.type !== 'fields')
    .map((step) => ({
      question: step.title,
      answer: calculatorState.answers[step.id] || '',
    }))
    .filter((item) => item.answer);
}

function buildLeadRequestBody(form, eventName, extraPayload = {}) {
  const formData = new FormData(form);
  const metadata = {
    form_name: getFormName(form, eventName),
    source_id: eventName,
    page: window.location.pathname,
    page_url: window.location.href,
    submitted_at: new Date().toISOString(),
    website: '',
    ...Object.fromEntries(trackingKeys.map((key) => [key, queryParams.get(key) || ''])),
    ...extraPayload,
  };

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof File))) {
      formData.set(key, JSON.stringify(value));
      return;
    }

    formData.set(key, String(value));
  });

  return formData;
}

async function submitLeadForm(form, eventName, extraPayload = {}) {
  const body = buildLeadRequestBody(form, eventName, extraPayload);
  const response = await fetch(LEAD_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      Accept: 'application/json',
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Не удалось отправить заявку.');
  }

  return payload;
}

function showFormMessage(form, text, type) {
  const message = form.querySelector('[data-form-message]');

  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.state = type;
}

function handleGenericFormSubmit(form, eventName, extraPayload = {}) {
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === 'true') {
      return;
    }

    if (!form.reportValidity()) {
      return;
    }

    const phone = form.querySelector('input[name="phone"]');

    if (phone && !validatePhone(phone.value)) {
      showFormMessage(form, 'Проверьте номер телефона: нужно не меньше 11 цифр.', 'error');
      phone.focus();
      return;
    }

    form.dataset.submitting = 'true';
    showFormMessage(form, 'Отправляем заявку...', 'idle');

    try {
      appendTrackingFields(form, extraPayload);
      const payload = getFormPayload(form, extraPayload);
      const responsePayload = await submitLeadForm(form, eventName, extraPayload);

      window.__stroyDachaLeads = window.__stroyDachaLeads || [];
      window.__stroyDachaLeads.push({ eventName, payload });

      trackEvent(eventName, payload);
      trackFormGoal(payload);
      showFormMessage(form, responsePayload.message || 'Заявка отправлена.', 'success');
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить заявку.';
      showFormMessage(form, errorMessage, 'error');
    } finally {
      form.dataset.submitting = 'false';
    }
  });
}

function bindCalculator() {
  if (
    !roots.calculatorStep ||
    !roots.calculatorPrev ||
    !roots.calculatorNext ||
    !roots.calculatorForm
  ) {
    return;
  }

  roots.calculatorStep.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const card = target.closest('.option-card');

    if (!card) {
      return;
    }

    const input = card.querySelector('.option-card__input');

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    event.preventDefault();
    const step = calculatorSteps[calculatorState.currentStep];
    calculatorState.answers[step.id] = input.value;
    renderCalculatorStep();

    if (step.type === 'fields') {
      return;
    }

    clearCalculatorAutoAdvance();
    calculatorState.autoAdvanceTimeout = window.setTimeout(() => {
      if (calculatorState.currentStep >= calculatorSteps.length - 1) {
        calculatorState.autoAdvanceTimeout = null;
        return;
      }

      const activeStep = calculatorSteps[calculatorState.currentStep];
      const value = getSelectedCalculatorValue(activeStep.id);

      if (!value) {
        calculatorState.autoAdvanceTimeout = null;
        return;
      }

      calculatorState.answers[activeStep.id] = value;
      showFormMessage(roots.calculatorForm, '', 'idle');
      calculatorState.currentStep = Math.min(calculatorSteps.length - 1, calculatorState.currentStep + 1);
      calculatorState.autoAdvanceTimeout = null;
      renderCalculatorStep();
    }, 200);
  });

  roots.calculatorStep.addEventListener('change', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const step = calculatorSteps[calculatorState.currentStep];
    calculatorState.answers[step.id] = target.value;
    renderCalculatorStep();
  });

  roots.calculatorPrev.addEventListener('click', () => {
    clearCalculatorAutoAdvance();
    calculatorState.currentStep = Math.max(0, calculatorState.currentStep - 1);
    showFormMessage(roots.calculatorForm, '', 'idle');
    renderCalculatorStep();
  });

  roots.calculatorNext.addEventListener('click', async () => {
    clearCalculatorAutoAdvance();
    const step = calculatorSteps[calculatorState.currentStep];

    if (step.type !== 'fields') {
      const value = getSelectedCalculatorValue(step.id);

      if (!value) {
        showFormMessage(roots.calculatorForm, 'Выберите один из вариантов, чтобы продолжить.', 'error');
        return;
      }

      calculatorState.answers[step.id] = value;
      showFormMessage(roots.calculatorForm, '', 'idle');
      calculatorState.currentStep = Math.min(calculatorSteps.length - 1, calculatorState.currentStep + 1);
      renderCalculatorStep();
      return;
    }

    const phone = roots.calculatorForm.querySelector('input[name="phone"]');

    if (phone && !validatePhone(phone.value)) {
      showFormMessage(roots.calculatorForm, 'Проверьте номер телефона: нужно не меньше 11 цифр.', 'error');
      phone.focus();
      return;
    }

    if (roots.calculatorForm.dataset.submitting === 'true') {
      return;
    }

    roots.calculatorForm.dataset.submitting = 'true';
    showFormMessage(roots.calculatorForm, 'Отправляем заявку...', 'idle');

    const extraPayload = {
      task_type: calculatorState.answers.task_type || '',
      roof_area: calculatorState.answers.roof_area || '',
      quiz_answers: buildQuizAnswers(),
    };

    try {
      appendTrackingFields(roots.calculatorForm, extraPayload);
      const payload = getFormPayload(roots.calculatorForm, extraPayload);
      const responsePayload = await submitLeadForm(roots.calculatorForm, 'submit_calculator', extraPayload);

      window.__stroyDachaLeads = window.__stroyDachaLeads || [];
      window.__stroyDachaLeads.push({ eventName: 'submit_calculator', payload });

      trackEvent('submit_calculator', payload);
      trackFormGoal(payload);
      showFormMessage(roots.calculatorForm, responsePayload.message || 'Заявка отправлена.', 'success');
      roots.calculatorForm.reset();
      calculatorState.currentStep = 0;
      calculatorState.answers = {};
      renderCalculatorStep();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось отправить заявку.';
      showFormMessage(roots.calculatorForm, errorMessage, 'error');
    } finally {
      roots.calculatorForm.dataset.submitting = 'false';
    }
  });
}

function bindAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');

      if (!href || href === '#') {
        return;
      }

      const target = document.querySelector(href);

      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function bindServicesDropdown() {
  const dropdownItems = document.querySelectorAll('.nav__item--has-dropdown');

  if (dropdownItems.length === 0) {
    return;
  }

  const closeDropdowns = () => {
    dropdownItems.forEach((item) => {
      item.classList.remove('is-open');
      const toggle = item.querySelector('.nav__toggle');

      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  };

  dropdownItems.forEach((item) => {
    const toggle = item.querySelector('.nav__toggle');

    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      closeDropdowns();

      if (!isOpen) {
        item.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Element) || target.closest('.nav__item--has-dropdown')) {
      return;
    }

    closeDropdowns();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdowns();
    }
  });
}

function bindMobileHeaderMenu() {
  const toggle = document.querySelector('.header-bar__menu-toggle');
  const nav = document.querySelector('#header-nav');

  if (!toggle || !nav) {
    return;
  }

  const closeMenu = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
  };

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

function bindExternalClicks() {
  document.querySelectorAll(`a[href="${companyData.phoneHref}"]`).forEach((link) => {
    link.addEventListener('click', () => trackEvent('click_phone', { phone: companyData.phone }));
  });

  document.querySelectorAll(`a[href="${companyData.telegram}"]`).forEach((link) => {
    link.addEventListener('click', () => trackEvent('click_telegram', { telegram: companyData.telegram }));
  });
}

function bindFaq() {
  document.querySelectorAll('.faq__item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) {
        return;
      }

      document.querySelectorAll('.faq__item').forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.open = false;
        }
      });
    });
  });
}

function openProjectModal(projectIndex) {
  const project = projects[projectIndex];

  roots.modal.classList.remove('project-modal--lightbox');
  roots.modalContent.innerHTML = `
    <div class="project-modal__grid">
      <div class="project-modal__gallery">
        ${project.images
          .map(
            (image) => `
              <img
                class="project-modal__image"
                src="${image.src}"
                alt="${image.alt}"
                loading="lazy"
                width="960"
                height="640"
              />
            `,
          )
          .join('')}
      </div>
      <div class="project-modal__info">
        <p class="project-modal__eyebrow">${project.location || 'Кровельный объект'}</p>
        <h2 class="project-modal__title">${project.title}</h2>
        <p class="project-modal__text">${project.description}</p>
        <ul class="project-modal__facts">
          ${project.area ? `<li>Площадь: ${project.area}</li>` : ''}
          ${project.material ? `<li>Покрытие: ${project.material}</li>` : ''}
          ${project.duration ? `<li>Срок: ${project.duration}</li>` : ''}
          ${project.price ? `<li>Стоимость: ${project.price}</li>` : ''}
        </ul>
        <h3 class="project-modal__subtitle">Что выполнено</h3>
        <ul class="project-modal__works">
          ${project.workList.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  roots.modal.showModal();
  trackEvent('project_open', { project: project.title });
}

function openPhotoEstimateModal() {
  if (!roots.modal || !roots.modalContent) {
    return;
  }

  roots.modal.classList.remove('project-modal--lightbox');
  roots.modalContent.innerHTML = `
    <div class="estimate-modal">
      <div class="estimate-modal__media">
        <img class="estimate-modal__image" src="${heroUploadImage}" alt="Иллюстрация загрузки фотографии кровли" width="180" height="124" />
      </div>
      <div class="estimate-modal__body">
        <h2 class="estimate-modal__title">Рассчитаем стоимость кровельных работ по фото</h2>
        <p class="estimate-modal__text">Оценим объём работ, уточним узлы и свяжемся для расчёта.</p>
        <form class="form-shell estimate-modal__form" id="photo-estimate-form" action="/api/lead.php" method="post" enctype="multipart/form-data" novalidate>
          <div class="estimate-modal__fields">
            <label class="field estimate-modal__field">
              <span class="field__label">Имя</span>
              <input class="field__control" type="text" name="name" autocomplete="name" placeholder="Ваше имя" />
            </label>
            <label class="field estimate-modal__field">
              <span class="field__label">Телефон</span>
              <input class="field__control" type="tel" name="phone" autocomplete="tel" placeholder="+7 (___) ___-__-__" required />
            </label>
          </div>
          <label class="upload-field estimate-modal__upload">
            <input class="upload-field__input" type="file" name="projectFile" accept=".jpg,.jpeg,.png,.webp,image/*" required />
            <span class="estimate-modal__upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><path d="M11 5h2v8.2l2.6-2.6 1.4 1.4-5 5-5-5 1.4-1.4 2.6 2.6V5ZM5 19h14v2H5v-2Z"/></svg>
            </span>
            <span class="estimate-modal__upload-body">
              <span class="upload-field__title">Загрузить фото кровли</span>
              <span class="upload-field__hint">JPG, PNG или WEBP</span>
            </span>
          </label>
          <button class="button button--primary estimate-modal__submit" type="submit">Получить расчёт</button>
          <label class="form-consent estimate-modal__policy">
            <input class="form-consent__input" type="checkbox" name="privacy_agree" required />
            <span class="form-consent__check" aria-hidden="true"></span>
            <span class="form-consent__text">Ознакомлен и согласен с условиями <a href="/privacy-policy/" target="_blank" rel="noopener noreferrer">политики конфиденциальности</a>.</span>
          </label>
          <p class="form-shell__message" data-form-message></p>
        </form>
      </div>
    </div>
  `;

  const form = roots.modalContent.querySelector('#photo-estimate-form');
  if (form instanceof HTMLFormElement) {
    bindUploads();
    handleGenericFormSubmit(form, 'submit_photo_estimate_form', {
      form_variant: 'header_photo_estimate',
    });
  }

  roots.modal.showModal();
  trackEvent('header_photo_estimate_open');
}

function renderProjectGalleryModal() {
  const project = projects[projectGalleryState.projectIndex];
  const images = project?.images || [];
  const image = images[projectGalleryState.imageIndex];

  if (!project || !image) {
    return;
  }

  const hasMultipleImages = images.length > 1;

  roots.modalContent.innerHTML = `
    <div class="project-lightbox">
      <div class="project-lightbox__stage">
        <img class="project-lightbox__image" src="${image.src}" alt="${image.alt || project.title}" width="1200" height="800" />
        ${
          hasMultipleImages
          ? '<button class="project-lightbox__nav project-lightbox__nav--prev" type="button" data-project-gallery-nav="prev" aria-label="Предыдущее фото"><img src="/src/assets/next-svgrepo-com.svg" alt="" aria-hidden="true" loading="lazy" width="24" height="24" /></button><button class="project-lightbox__nav project-lightbox__nav--next" type="button" data-project-gallery-nav="next" aria-label="Следующее фото"><img src="/src/assets/next-svgrepo-com.svg" alt="" aria-hidden="true" loading="lazy" width="24" height="24" /></button>'
            : ''
        }
      </div>
      ${
        hasMultipleImages
          ? `<div class="project-lightbox__thumbs" aria-label="Фотографии кейса">
              ${images
                .map(
                  (thumb, index) => `
                    <button
                      class="project-lightbox__thumb${index === projectGalleryState.imageIndex ? ' is-active' : ''}"
                      type="button"
                      data-project-gallery-thumb="${index}"
                      aria-label="Открыть фото ${index + 1}"
                    >
                      <img src="${thumb.src}" alt="" loading="lazy" width="140" height="90" />
                    </button>
                  `,
                )
                .join('')}
            </div>`
          : ''
      }
    </div>
  `;
}

function moveProjectGallery(direction) {
  const project = projects[projectGalleryState.projectIndex];
  const images = project?.images || [];

  if (images.length < 2) {
    return;
  }

  projectGalleryState.imageIndex = (projectGalleryState.imageIndex + direction + images.length) % images.length;
  renderProjectGalleryModal();
}

function openProjectGallery(projectIndex, imageIndex = 0) {
  const project = projects[projectIndex];
  const images = project?.images || [];

  if (!project || !images.length) {
    return;
  }

  projectGalleryState.projectIndex = projectIndex;
  projectGalleryState.imageIndex = Math.max(0, Math.min(imageIndex, images.length - 1));
  roots.modal.classList.add('project-modal--lightbox');
  renderProjectGalleryModal();
  roots.modal.showModal();
  trackEvent('project_gallery_open', { project: project.title });
}

function bindProjects() {
  if (!roots.projects) {
    return;
  }

  const getProjectIndex = (card) => {
    const cards = Array.from(roots.projects.querySelectorAll('.project-showcase-card'));
    return cards.indexOf(card);
  };

  const getCardImages = (card) =>
    Array.from(card.querySelectorAll('.project-stage__image'))
      .filter((image) => image instanceof HTMLImageElement)
      .map((image) => ({
        src: image.currentSrc || image.src,
        alt: image.alt || '',
      }));

  const getActiveImageIndex = (card) => {
    const cover = card.querySelector('.project-showcase-card__cover');
    const images = getCardImages(card);

    if (!(cover instanceof HTMLImageElement) || !images.length) {
      return 0;
    }

    const coverUrl = new URL(cover.currentSrc || cover.src, window.location.href).href;
    const index = images.findIndex((image) => new URL(image.src, window.location.href).href === coverUrl);
    return index >= 0 ? index : 0;
  };

  const setActiveStage = (stage) => {
    const card = stage.closest('.project-showcase-card');
    const stageImage = stage.querySelector('.project-stage__image');
    const cover = card?.querySelector('.project-showcase-card__cover');

    if (!(stageImage instanceof HTMLImageElement) || !(cover instanceof HTMLImageElement)) {
      return;
    }

    card.querySelectorAll('.project-stage').forEach((item) => {
      item.classList.toggle('is-active', item === stage);
      item.setAttribute('aria-pressed', item === stage ? 'true' : 'false');
    });

    cover.classList.remove(
      'project-stage__image--before',
      'project-stage__image--process',
      'project-stage__image--after',
    );
    stageImage.classList.forEach((className) => {
      if (className.startsWith('project-stage__image--')) {
        cover.classList.add(className);
      }
    });

    cover.src = stageImage.currentSrc || stageImage.src;
    cover.alt = stageImage.alt;
    cover.style.objectPosition = window.getComputedStyle(stageImage).objectPosition;
  };

  roots.projects.querySelectorAll('.project-showcase-card').forEach((card) => {
    const stages = card.querySelectorAll('.project-stage');
    const media = card.querySelector('.project-showcase-card__media');
    const projectIndex = getProjectIndex(card);

    if (projectIndex >= 0 && projects[projectIndex]) {
      const images = getCardImages(card);

      if (images.length) {
        projects[projectIndex].images = images;
      }
    }

    if (media instanceof HTMLElement) {
      media.setAttribute('role', 'button');
      media.setAttribute('tabindex', '0');
      media.setAttribute('aria-label', 'Открыть галерею фото кейса');
    }

    stages.forEach((stage) => {
      stage.setAttribute('role', 'button');
      stage.setAttribute('tabindex', '0');
      stage.setAttribute('aria-pressed', 'false');
    });

    const initialStage = stages[0];

    if (initialStage) {
      setActiveStage(initialStage);
    }
  });

  bindProjectsShowMore();

  roots.projects.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const stage = target.closest('.project-stage');

    if (stage) {
      setActiveStage(stage);
      return;
    }

    const media = target.closest('.project-showcase-card__media');

    if (media) {
      const card = media.closest('.project-showcase-card');
      const projectIndex = card ? getProjectIndex(card) : -1;

      if (card && projectIndex >= 0) {
        openProjectGallery(projectIndex, getActiveImageIndex(card));
      }

      return;
    }

  });

  roots.projects.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const stage = target.closest('.project-stage');

    if (stage) {
      event.preventDefault();
      setActiveStage(stage);
      return;
    }

    const media = target.closest('.project-showcase-card__media');

    if (media) {
      const card = media.closest('.project-showcase-card');
      const projectIndex = card ? getProjectIndex(card) : -1;

      if (card && projectIndex >= 0) {
        event.preventDefault();
        openProjectGallery(projectIndex, getActiveImageIndex(card));
      }
    }
  });
}

function bindProjectsShowMore() {
  if (!roots.projects?.classList.contains('projects-showcase')) {
    return;
  }

  const visibleLimit = 3;
  const cards = Array.from(roots.projects.querySelectorAll('.project-showcase-card'));
  const hiddenCards = cards.slice(visibleLimit);
  const existingMore = roots.projects.nextElementSibling;

  if (existingMore?.classList.contains('projects-showcase__more')) {
    existingMore.remove();
  }

  cards.forEach((card, index) => {
    card.classList.toggle('project-showcase-card--hidden', index >= visibleLimit);
  });

  if (!hiddenCards.length) {
    return;
  }

  const more = document.createElement('div');
  more.className = 'projects-showcase__more';
  more.innerHTML = '<button class="projects-showcase__more-button" type="button">Показать все</button>';

  roots.projects.insertAdjacentElement('afterend', more);

  more.querySelector('.projects-showcase__more-button')?.addEventListener('click', () => {
    hiddenCards.forEach((card) => card.classList.remove('project-showcase-card--hidden'));
    more.remove();
    trackEvent('projects_show_all');
  });
}

function bindProjectModal() {
  if (!roots.modal || !roots.modalContent) {
    return;
  }

  const closeControl = roots.modal.querySelector('.project-modal__close');
  const closeModal = (event) => {
    event.preventDefault();
    roots.modal.classList.remove('project-modal--lightbox');
    roots.modal.close();
  };

  closeControl?.addEventListener('click', closeModal);
  closeControl?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      closeModal(event);
    }
  });

  roots.modalContent.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const nav = target.closest('[data-project-gallery-nav]');

    if (nav) {
      moveProjectGallery(nav.getAttribute('data-project-gallery-nav') === 'prev' ? -1 : 1);
      return;
    }

    const thumb = target.closest('[data-project-gallery-thumb]');

    if (thumb) {
      const index = Number(thumb.getAttribute('data-project-gallery-thumb'));

      if (Number.isFinite(index)) {
        projectGalleryState.imageIndex = index;
        renderProjectGalleryModal();
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!roots.modal.open || !roots.modalContent.querySelector('.project-lightbox')) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveProjectGallery(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveProjectGallery(1);
    }
  });
}

function bindHeaderPhotoEstimate() {
  document.querySelectorAll('.header-bar__call').forEach((button) => {
    button.addEventListener('click', () => {
      openPhotoEstimateModal();
    });
  });
}

function bindUploads() {
  document.querySelectorAll('.upload-field').forEach((field) => {
    const input = field.querySelector('.upload-field__input');
    const title = field.querySelector('.upload-field__title');

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        title.textContent = input.files[0].name;
      }
    });
  });
}

function bindReviewsSlider() {
  document.querySelectorAll('.reviews__slider').forEach((slider) => {
    const cards = slider.querySelector('.reviews__cards');
    const previousButton = slider.querySelector('.reviews__arrow--prev');
    const nextButton = slider.querySelector('.reviews__arrow--next');
    const dots = Array.from(slider.nextElementSibling?.querySelectorAll('.reviews__dot') || []);

    if (!cards || !previousButton || !nextButton) {
      return;
    }

    const total = cards.children.length;
    let activeIndex = 0;

    const updateDots = () => {
      dots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index === activeIndex);
      });
    };

    const move = (direction) => {
      if (total < 2) {
        return;
      }

      if (direction > 0) {
        cards.append(cards.firstElementChild);
        activeIndex = (activeIndex + 1) % total;
      } else {
        cards.prepend(cards.lastElementChild);
        activeIndex = (activeIndex - 1 + total) % total;
      }

      updateDots();
      trackEvent('reviews_slider_move', { direction: direction > 0 ? 'next' : 'prev' });
    };

    previousButton.addEventListener('click', () => move(-1));
    nextButton.addEventListener('click', () => move(1));
    updateDots();
  });
}

function bindCtas() {
  document.querySelectorAll('[data-cta="calculate"]').forEach((link) => {
    link.addEventListener('click', () => trackEvent('click_calculate_roof'));
  });

  document.querySelectorAll('[data-cta="send-project"]').forEach((link) => {
    link.addEventListener('click', () => trackEvent('click_send_project'));
  });
}

function bindPricingFactorCards() {
  const cards = Array.from(document.querySelectorAll('.pricing-factor-card'));

  if (!cards.length) {
    return;
  }

  cards.forEach((card) => {
    const mediaImage = card.querySelector('.pricing-factor-card__image');
    const indexBadge = card.querySelector('.pricing-factor-card__index');
    const thumbs = Array.from(card.querySelectorAll('.pricing-factor-card__thumb'));

    if (mediaImage instanceof HTMLImageElement && thumbs.length) {
      thumbs.forEach((thumb) => {
        if (!(thumb instanceof HTMLButtonElement)) {
          return;
        }

        thumb.addEventListener('click', (event) => {
          event.preventDefault();

          const nextImage = thumb.dataset.pricingImage;
          const nextPreview = thumb.querySelector('img');
          const nextPrice = thumb.querySelector('.pricing-factor-card__thumb-label strong');

          if (!nextImage) {
            return;
          }

          mediaImage.src = nextImage;
          if (nextPreview instanceof HTMLImageElement) {
            mediaImage.alt = nextPreview.alt || mediaImage.alt;
          }
          if (indexBadge && nextPrice) {
            indexBadge.textContent = nextPrice.textContent || '';
          }

          thumbs.forEach((item) => item.classList.remove('is-active'));
          thumb.classList.add('is-active');
        });
      });
    }
  });
}

function init() {
  applyCompanyData();
  renderCalculatorStep();
  bindAnchors();
  bindMobileHeaderMenu();
  bindServicesDropdown();
  bindCalculator();
  bindExternalClicks();
  bindFaq();
  bindProjects();
  bindProjectModal();
  bindHeaderPhotoEstimate();
  bindUploads();
  bindReviewsSlider();
  bindPricingFactorCards();
  bindCtas();
  handleGenericFormSubmit(roots.leadForm, 'submit_lead_form');
  handleGenericFormSubmit(roots.auditForm, 'submit_audit_form');
}

init();
