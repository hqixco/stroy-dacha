export const calculatorSteps = [
  {
    id: 'task_type',
    shortTitle: 'Задача',
    title: 'Что нужно сделать?',
    type: 'options',
    options: [
      'Монтаж новой кровли',
      'Полная замена кровли',
      'Ремонт или реконструкция',
      'Нужна консультация',
    ],
  },
  {
    id: 'roof_area',
    shortTitle: 'Площадь',
    title: 'Какая примерная площадь кровли?',
    type: 'options',
    options: [
      'До 100 м²',
      '100–150 м²',
      '150–250 м²',
      'Более 250 м²',
      'Не знаю площадь',
    ],
  },
  {
    id: 'contact_details',
    shortTitle: 'Контакты',
    title: 'Куда отправить расчёт?',
    description:
      'Уточним покрытие и сложные узлы по телефону',
    type: 'fields',
  },
];
