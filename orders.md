# 5 заказов на трекеры (для обучения)

Все заказы реальные. Большинство уже закрыто/в архиве — брать их как готовые ТЗ для учебных проектов.

> **Статус:** заказ №1 — версия 2.0 реализована: сервер, публичная ссылка, несколько администраторов и приватная аналитика. Запуск и описание: [`README.md`](README.md). Подробное ТЗ, этапы и критерии приёмки: [`docs/SPEC.md`](docs/SPEC.md) · Word-версия: [ТЗ — Анонимный трекер оценок партнёра.docx](<docs/ТЗ — Анонимный трекер оценок партнёра.docx>)

---

## 1. Анонимный трекер оценок с графиками
- **Бюджет:** 55 000 ₽ · **Срок:** 7 дней
- **Опубликован:** 18.07.2026 · **Статус:** архив
- **Ссылка:** https://www.fl.ru/projects/5514303/otsenka-uverennosti-i-chuvstvitelnosti-partnra--anonimnyiy-treker-s-grafikami.html

**Что нужно:** веб-приложение для анонимного сбора оценок.
- Оценка по 5 параметрам (1–10): уверенность, чувствительность, инициативность, адаптивность, общее впечатление.
- Доп. поля: пол (М/Ж), возраст (до 25 / 25–35 / 35+).
- После отправки — статистика: средние по каждому параметру + гистограмма по возрастам.
- Хранилище — `localStorage`, графики — `Chart.js`.

**Чему учит:** формы, валидация, агрегация данных, Chart.js, адаптивность. Хороший первый проект «под ключ».

---

## 2. Flutter-приложение: GPS-трекинг, карты, своя БД
- **Бюджет:** по договоренности
- **Опубликован:** 14.04.2026 · **Статус:** архив
- **Ссылка:** https://www.fl.ru/projects/5500046/flutter-prilojenie-treking-kartyi-svoya-bd-na-timeweb-cloud.html

**Что нужно:** готовый UI на FlutterFlow, реализовать backend и трекинг.
- Backend + БД (PostgreSQL/MySQL) на Timeweb Cloud, без Firebase.
- Регистрация/логин через свой backend (email + пароль), токены сессий.
- REST API на PHP/Node.js/Python.
- Карты (Яндекс/Google/Mapbox), запись GPS-трека в реальном времени, сохранение и отображение треков.
- Подготовка к сторам: права, package name/bundle ID, AAB и IPA.
- Обязательно: GitHub с историей коммитов, промежуточные показы каждые 7 дней.

**Чему учит:** full-stack мобильная разработка, авторизация, REST, работа с картами и геоданными.

---

## 3. Telegram-бот: трекер статусов посылок
- **Бюджет:** 12 000 ₽
- **Опубликован:** 06.03.2026 · **Статус:** архив
- **Ссылка:** https://www.fl.ru/projects/5492961/sozdat-treker-bota-dlya-otslejivaniya-statusov-posyilok.html

**Что нужно:** Telegram-бот для отслеживания статусов посылок, чтобы упорядочить отправку товаров.
- Приём трек-номеров, хранение, проверка статусов, уведомления.
- ТЗ короткое — много места для проектирования.

**Чему учит:** Telegram Bot API, работа с внешними API, фоновые задачи/планировщик, БД.

---

## 4. Автоматизация Яндекс.Трекера (Yandex Cloud + GPT + Telegram)
- **Бюджет:** по договоренности · **Срок:** 14–20 рабочих дней
- **Опубликован:** 27.11.2025 · **Статус:** архив
- **Ссылка:** https://www.fl.ru/projects/5472755/avtomatizatsiya-yandekstreker-na-funktsionale-yandex-cloude-responses-api-rag--embending-yandeks-wiki.html

**Что нужно:** система управления задачами в Яндекс.Трекере.
- Голосовые команды через Алису: показать просроченные, перенести дедлайн, назначить исполнителя, добавить комментарий, отчёт о нарушениях.
- Yandex Cloud Functions (Python 3.11+), YandexGPT (RAG + эмбеддинги), Яндекс Wiki как база стандартов.
- Вебхуки Трекера, уведомления в Telegram, проверка задач на соответствие стандартам.
- Модули: `main.py`, `tracker_client.py`, `yandexgpt_client.py`, `wiki_client.py`, `rag_module.py`, `telegram_client.py`, `validation.py`, `event_handlers.py`.
- Сдача: код, конфиги, `requirements.txt`, README, документация.

**Чему учит:** интеграции с API, serverless, RAG, вебхуки, событийная логика. Самый «взрослый» проект из подборки.

---

## 5. Приватный торрент-трекер для раздачи файлов
- **Бюджет:** по договоренности
- **Опубликован:** 17.10.2015 · **Статус:** закрыт
- **Ссылка:** https://www.weblancer.net/freelance/veb-programmirovanie-31/privatnii-torrent-treker-dlya-razdachi-failov-716993/

**Что нужно:** простой приватный BitTorrent-трекер на своём VDS (CentOS 6), раздача только своих файлов.
- Свои файлы от нескольких МБ до гигабайт, много сидов не будет.
- Не полноценный трекер с форумом — минималистичный и удобный.
- Открытый исходный код обязателен, оплата за результат.

**Чему учит:** сетевые протоколы, BitTorrent announce/scrape, серверная часть, деплой на Linux. Сложнее и «глубже» остальных.

---

## Бонусом (если захочется ещё)
- Android GPS-трекер с визуализацией трека и фото/видео на точках — https://www.fl.ru/projects/5191530/prilojenie-dlya-android-gps-treker-s-vizualizatsiey-treka-na-karte.html
- Настройка Яндекс.Трекера под процессы компании, 15 000 ₽ — https://www.fl.ru/projects/5510886/konsultatsiya-i-nastroyka-yandeks-treker.html
- Интеграция CPA tracker на сайте — https://www.weblancer.net/freelance/html-verstka-32/nastroika-cpa-tracker-dlya-lichnogo-saita-1008663/
- Установка AppsFlyer SDK в Android/iOS — https://www.weblancer.net/freelance/mobilnie-prilozheniya-28/ustanovit-treker-v-prilozhenii-1135294/
- Открытый торрент-трекер, $250 — https://www.weblancer.net/freelance/veb-programmirovanie-31/otkritii-torrent-treker-39172/
