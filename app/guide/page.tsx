'use client';

import { useRouter } from 'next/navigation';

export default function Guide() {
    const router = useRouter();

    return (
        <main className="guide-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>Инструкция по работе с парсером</h1>
                <button onClick={() => router.push('/')} className="button">Назад на Дашборд</button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                {/* Section 1: Dashboard */}
                <section className="card glass guide-section">
                    <h2>1. Основная панель (Дашборд)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <div>
                            <p>На этой странице вы выполняете ручной запуск проверки цен.</p>
                            <ul>
                                <li><strong>Выбор регионов:</strong> Выберите один или несколько городов для проверки.</li>
                                <li><strong>Прокси:</strong> Включите использование прокси, если сайт блокирует частые запросы (рекомендуется для больших объемов).</li>
                                <li><strong>Запуск:</strong> Нажмите «Обновить цены». Система начнет обход товаров из загруженного Excel-файла.</li>
                            </ul>
                            <p className="note">⚠️ Кнопка блокируется, если уже запущен автоматический или другой ручной парсинг.</p>
                        </div>
                        <img
                            src="/guide-images/dashboard.png"
                            alt="Дашборд"
                            style={{ borderRadius: '12px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        />
                    </div>
                </section>

                {/* Section 2: Products List */}
                <section className="card glass guide-section">
                    <h2>2. Управление товарами (Excel)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <img
                            src="/guide-images/products.png"
                            alt="Список товаров"
                            style={{ borderRadius: '12px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        />
                        <div>
                            <p>Парсер работает на основе списка товаров, загруженного через матрицу Excel.</p>
                            <ul>
                                <li><strong>Код партнера/Артикул:</strong> Используется для поиска товара на сайте Lemana Pro.</li>
                                <li><strong>РИЦ (Справочная цена):</strong> Цена, ниже которой продажа считается нарушением.</li>
                                <li><strong>Обновление:</strong> Вы можете загрузить новый файл в любой момент. Старые данные о товарах будут заменены актуальными из файла.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Section 3: History & Violations */}
                <section className="card glass guide-section">
                    <h2>3. История нарушений и отчеты</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <div>
                            <p>Все найденные отклонения цен попадают в «Историю цен».</p>
                            <ul>
                                <li><strong>Цветовая индикация:</strong> Красные ячейки указывают на цену ниже РИЦ.</li>
                                <li><strong>Скриншоты:</strong> Нажмите на иконку камеры 📷 рядом с ценой, чтобы увидеть скриншот-доказательство с меткой времени.</li>
                                <li><strong>Выгрузка в Excel:</strong> Кнопка «Выгрузить в Excel (с фото)» создаст файл, где скриншоты будут встроены прямо в таблицу для удобной отправки партнерам.</li>
                            </ul>
                        </div>
                        <img
                            src="/guide-images/history.png"
                            alt="История цен"
                            style={{ borderRadius: '12px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        />
                    </div>
                </section>

                {/* Section 4: Settings & Automation */}
                <section className="card glass guide-section">
                    <h2>4. Настройки и автоматизация</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <img
                            src="/guide-images/settings.png"
                            alt="Настройки"
                            style={{ borderRadius: '12px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        />
                        <div>
                            <p>Полная автоматизация вашей работы:</p>
                            <ul>
                                <li><strong>Профили расписания:</strong> Создавайте задачи на разное время и разные дни недели. Например: Москва — ежедневно в 08:00, регионы — по вторникам в 10:00.</li>
                                <li><strong>Telegram Уведомления:</strong> Введите Токен бота и ID чата, чтобы отчеты о нарушениях приходили сразу после завершения проверки.</li>
                                <li><strong>Хранение данных:</strong> Настройте срок хранения скриншотов (например, 3 дня), чтобы не перегружать память сервера. Старые фото удаляются автоматически.</li>
                            </ul>
                        </div>
                    </div>
                </section>

            </div>

            <footer style={{ marginTop: '4rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                <p>© 2026 Lemana Pro Price Parser System. Все права защищены.</p>
            </footer>

            <style jsx>{`
        .guide-section h2 {
          color: var(--accent);
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 0.5rem;
        }
        .guide-section p, .guide-section li {
          line-height: 1.6;
          margin-bottom: 1rem;
        }
        .guide-section ul {
          padding-left: 1.5rem;
        }
        .note {
          background: rgba(224, 172, 43, 0.1);
          padding: 1rem;
          border-left: 4px solid var(--accent);
          border-radius: 4px;
        }
        strong {
          color: var(--accent);
        }
      `}</style>
        </main>
    );
}
