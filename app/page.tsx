'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface Product {
  sku: string;
  name: string;
  referencePrice?: number;
}

interface Region {
  name: string;
  subdomain: string;
}

interface PriceData {
  [key: string]: { price: string; screenshot?: string };
}

interface HistoryItem {
  id: number;
  sku: string;
  price: string;
  referencePrice?: number;
  region: string;
  url: string;
  screenshot?: string;
  createdAt: string;
}

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  // Tabs: 'dashboard' | 'history'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [jobStatus, setJobStatus] = useState<{ running: boolean; userName?: string } | null>(null);
  const [settings, setSettings] = useState<any>({
    tgBotToken: '',
    tgChatId: '',
    enabled: false,
    historyRetentionDays: 3
  });
  const [newTime, setNewTime] = useState('09:00');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [newScheduleRegions, setNewScheduleRegions] = useState<string[]>([]);
  const [newScheduleDays, setNewScheduleDays] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLocalParsing, setIsLocalParsing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [prodRes, regRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/regions')
      ]);
      setProducts(prodRes.data);
      setRegions(regRes.data);
    } catch (error) {
      console.error('Failed to fetch initial data', error);
      // router.push('/login'); 
    }
  };

  const checkJobStatus = async () => {
    try {
      const res = await axios.get('/api/parse/status');
      setJobStatus(res.data);
      if (res.data.running) {
        setLoading(true);
      } else if (loading && !res.data.running && !isLocalParsing) {
        // Only stop loading if we are NOT doing a local batched parse
        setLoading(false);
        fetchHistory();
      }
    } catch (e) {
      console.error('Status check failed', e);
    }
  };

  useEffect(() => {
    checkJobStatus();
    const interval = setInterval(checkJobStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [loading]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to fetch history', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
    if (activeTab === 'settings') {
      fetchSettings();
      fetchSchedules();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      const data = res.data;
      setSettings({
        ...data
      });
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  const saveSettings = async () => {
    try {
      await axios.post('/api/settings', settings);
      showToast('Настройки успешно сохранены!', 'success');
    } catch (e) {
      showToast('Ошибка при сохранении настроек', 'error');
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axios.get('/api/settings/schedules');
      setSchedules(res.data);
    } catch (e) {
      console.error('Failed to fetch schedules', e);
    }
  };

  const addSchedule = async () => {
    if (newScheduleDays.length === 0 || newScheduleRegions.length === 0) {
      showToast('Выберите хотя бы один день и один регион', 'error');
      return;
    }
    try {
      await axios.post('/api/settings/schedules', {
        time: newTime,
        days: newScheduleDays,
        regions: newScheduleRegions,
        enabled: true
      });
      showToast('Расписание добавлено');
      fetchSchedules();
    } catch (e) {
      showToast('Ошибка при добавлении расписания', 'error');
    }
  };

  const deleteSchedule = async (id: number) => {
    try {
      await axios.delete(`/api/settings/schedules/${id}`);
      showToast('Расписание удалено');
      fetchSchedules();
    } catch (e) {
      showToast('Ошибка при удалении', 'error');
    }
  };

  const toggleSchedule = async (schedule: any) => {
    try {
      await axios.post('/api/settings/schedules', {
        ...schedule,
        days: typeof schedule.days === 'string' ? JSON.parse(schedule.days) : schedule.days,
        regions: typeof schedule.regions === 'string' ? JSON.parse(schedule.regions) : schedule.regions,
        enabled: !schedule.enabled
      });
      fetchSchedules();
    } catch (e) {
      showToast('Ошибка при обновлении', 'error');
    }
  };

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  };

  const toggleRegion = (region: Region) => {
    setSelectedRegions(prev =>
      prev.find(r => r.subdomain === region.subdomain)
        ? prev.filter(r => r.subdomain !== region.subdomain)
        : [...prev, region]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await axios.post('/api/upload', formData);
      // Refresh products
      const prodRes = await axios.get('/api/products');
      setProducts(prodRes.data);
      alert('Файл успешно загружен и список товаров обновлен!');
    } catch (error) {
      console.error('Upload failed', error);
      alert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const startParsing = async () => {
    if (selectedRegions.length === 0) return;
    setLoading(true);
    setIsLocalParsing(true);
    setParsingProgress(0);

    const batchSize = 5;
    const totalToParse = products.length * selectedRegions.length;
    let completedCount = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batchProducts = products.slice(i, i + batchSize);

      try {
        const res = await axios.post('/api/parse', {
          products: batchProducts,
          regions: selectedRegions,
          useProxy
        });

        const newPrices: PriceData = {};
        res.data.forEach((item: any) => {
          newPrices[`${item.sku}_${item.region}`] = {
            price: item.price,
            screenshot: item.screenshot
          };
        });

        setPrices(prev => ({ ...prev, ...newPrices }));
        completedCount += batchProducts.length * selectedRegions.length;
        setParsingProgress(Math.floor((completedCount / totalToParse) * 100));
      } catch (error: any) {
        console.error('Error parsing batch', error);
        const errMsg = error.response?.data?.error || error.message;
        showToast(`Ошибка парсинга: ${errMsg}`, 'error');
        break; // Stop on error
      }
    }

    setLoading(false);
    setIsLocalParsing(false);
    if (activeTab === 'history') fetchHistory();
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Нарушения');

    // Group items by SKU from the history
    const skus = Array.from(new Set(history.map(item => item.sku)));
    const regions = Array.from(new Set(history.map(item => item.region)));

    const columns: any[] = [
      { header: 'Дата', key: 'date', width: 22 },
      { header: 'Артикул', key: 'sku', width: 15 },
      { header: 'РИЦ', key: 'refPrice', width: 12 },
    ];

    regions.forEach(reg => {
      columns.push({ header: reg, key: reg, width: 30 });
    });

    worksheet.columns = columns;
    worksheet.getRow(1).height = 30;
    worksheet.getRow(1).font = { bold: true };

    for (const [idx, sku] of skus.entries()) {
      const rowNumber = idx + 2;
      const skuItems = history.filter(item => item.sku === sku);
      const refPrice = skuItems[0].referencePrice;
      const date = new Date(skuItems[0].createdAt).toLocaleString('ru-RU');

      const rowValue: any = {
        date,
        sku,
        refPrice: refPrice ? `${refPrice} ₽` : '-'
      };

      // Fill in text price data for each region
      regions.forEach(reg => {
        const item = skuItems.find(i => i.region === reg);
        if (item) {
          rowValue[reg] = `${item.price} ₽`;
        }
      });

      worksheet.addRow(rowValue);
      worksheet.getRow(rowNumber).height = 100;

      // Add images for each region violation
      for (const [regIdx, reg] of regions.entries()) {
        const item = skuItems.find(i => i.region === reg);
        if (item && item.screenshot) {
          try {
            const response = await fetch(item.screenshot);
            const buffer = await response.arrayBuffer();
            const imageId = workbook.addImage({
              buffer,
              extension: 'png',
            });

            worksheet.addImage(imageId, {
              tl: { col: 3 + regIdx, row: rowNumber - 1 },
              ext: { width: 180, height: 100 }
            });
          } catch (e) {
            console.error('Failed to add image to excel', e);
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `violations_grouped_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getPriceBadgeClass = (price: string, refPrice?: number) => {
    if (!price) return 'badge badge-pending';
    if (price === '0' || price === 'Error') return 'badge badge-error';

    // If no reference price, just show neutral/success
    if (!refPrice) return 'badge badge-neutral';

    const numericPrice = parseInt(price.replace(/[^0-9]/g, ''), 10);
    // Logic: Red if parsed < ref, Green otherwise
    if (numericPrice < refPrice) {
      return 'badge badge-error';
    }
    return 'badge badge-success';
  };

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Lemana Pro Price Parser</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={`button ${activeTab === 'dashboard' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ opacity: activeTab === 'dashboard' ? 1 : 0.7 }}
          >
            Дашборд
          </button>
          <button
            className={`button ${activeTab === 'history' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ opacity: activeTab === 'history' ? 1 : 0.7 }}
          >
            История цен
          </button>
          <button
            className={`button ${activeTab === 'settings' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ opacity: activeTab === 'settings' ? 1 : 0.7 }}
          >
            Настройки
          </button>
          <button onClick={handleLogout} style={{ background: '#ff4444', color: 'white', border: 'none' }}>
            Выход
          </button>
          <button
            onClick={() => router.push('/guide')}
            className="button"
            style={{ background: 'var(--secondary)', border: 'none' }}
          >
            📖 Инструкция
          </button>
        </div>
      </header>

      {activeTab === 'dashboard' && (
        <>
          <section className="card glass">
            <h2>Настройки регионов</h2>
            <div className="region-selector">
              {regions.map(region => (
                <div
                  key={region.subdomain || 'moscow'}
                  className={`region-tag ${selectedRegions.find(r => r.subdomain === region.subdomain) ? 'active' : ''}`}
                  onClick={() => toggleRegion(region)}
                >
                  {region.name}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="proxy-toggle"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
              />
              <label htmlFor="proxy-toggle" style={{ cursor: 'pointer', fontWeight: 500 }}>Использовать прокси (Mangoproxy)</label>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={startParsing}
                disabled={loading || jobStatus?.running || selectedRegions.length === 0}
              >
                {loading || (jobStatus?.running && !loading) ? (
                  jobStatus?.userName ? `Пользователь ${jobStatus.userName} уже парсит...` : `Парсинг в процессе...`
                ) : 'Обновить цены'}
              </button>
              {jobStatus?.running && !loading && (
                <p style={{ color: 'var(--accent)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  ⚠️ Системный или автоматический парсинг уже выполняется.
                </p>
              )}
            </div>
          </section>

          <section className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Товары из Excel</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <label className="button" style={{
                  background: 'var(--secondary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid var(--border)'
                }}>
                  {uploading ? 'Загрузка...' : 'Загрузить Excel файл'}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Артикул</th>
                    <th>Наименование</th>
                    <th>РИЦ</th>
                    {selectedRegions.map(region => (
                      <th key={region.subdomain || 'moscow'}>{region.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.sku}>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{product.referencePrice ? `${product.referencePrice} ₽` : '-'}</td>
                      {selectedRegions.map(region => {
                        const priceKey = `${product.sku}_${region.subdomain || 'moscow'}`;
                        const priceData = prices[priceKey];
                        const price = priceData?.price;
                        const screenshot = priceData?.screenshot;
                        const badgeClass = getPriceBadgeClass(price, product.referencePrice);
                        return (
                          <td key={region.subdomain || 'moscow'}>
                            {price ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={badgeClass}>
                                  {price === '0' ? 'Ошибка' : `${price} ₽`}
                                </span>
                                {screenshot && (
                                  <a
                                    href={screenshot}
                                    target="_blank"
                                    download={`screenshot_${product.sku}.png`}
                                    title="Скачать скриншот (Доказательство)"
                                    style={{
                                      textDecoration: 'none',
                                      fontSize: '1.2rem',
                                      cursor: 'pointer',
                                      filter: badgeClass.includes('badge-error') ? 'none' : 'grayscale(100%)',
                                      opacity: badgeClass.includes('badge-error') ? 1 : 0.5
                                    }}
                                  >
                                    📸
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="badge badge-pending">Ожидание</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'history' && (
        <section className="card glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>История нарушений (Цена ниже РИЦ)</h2>
            <button onClick={exportToExcel} disabled={history.length === 0} className="button" style={{ background: '#217346' }}>
              📥 Выгрузить в Excel (с фото)
            </button>
          </div>

          {Object.keys(history.reduce((acc: any, item) => {
            const date = new Date(item.createdAt).toLocaleString('ru-RU');
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
          }, {})).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => {
            const runItems = history.filter(item => new Date(item.createdAt).toLocaleString('ru-RU') === date);
            // Group items in this run by SKU
            const skus = Array.from(new Set(runItems.map(i => i.sku)));
            const runRegions = Array.from(new Set(runItems.map(i => i.region)));

            return (
              <div key={date} style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>Проверка от {date}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Артикул</th>
                        <th style={{ textAlign: 'left' }}>РИЦ</th>
                        {runRegions.map(reg => (
                          <th key={reg} style={{ textAlign: 'left' }}>{reg}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {skus.map(sku => {
                        const skuItems = runItems.filter(i => i.sku === sku);
                        const refPrice = skuItems[0].referencePrice;
                        return (
                          <tr key={sku}>
                            <td><a href={skuItems[0].url} target="_blank" style={{ color: '#4dabf7' }}>{sku}</a></td>
                            <td>{refPrice ? `${refPrice} ₽` : '-'}</td>
                            {runRegions.map(reg => {
                              const item = skuItems.find(i => i.region === reg);
                              return (
                                <td key={reg}>
                                  {item ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className="badge badge-error">
                                        {item.price} ₽
                                      </span>
                                      {item.screenshot && (
                                        <a href={item.screenshot} target="_blank" download={`violation_${sku}_${reg}.png`} title="Скачать">
                                          📸
                                        </a>
                                      )}
                                    </div>
                                  ) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>История пуста</div>
          )}
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="card glass" style={{ padding: '2.5rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.8rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Настройки автоматизации</h2>
            <p style={{ color: '#8b949e' }}>Управляйте ботом Telegram и расписанием проверок цен</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span> Telegram Бот
              </h3>
              <div className="form-group">
                <label>Токен бота (Telegram Bot Token)</label>
                <input
                  type="password"
                  value={settings.tgBotToken || ''}
                  onChange={e => setSettings({ ...settings, tgBotToken: e.target.value })}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                />
              </div>
              <div className="form-group">
                <label>Chat ID (номер чата или группы)</label>
                <input
                  type="text"
                  value={settings.tgChatId || ''}
                  onChange={e => setSettings({ ...settings, tgChatId: e.target.value })}
                  placeholder="-1001234567890"
                />
                <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '5px' }}>
                  Совет: добавьте бота в группу и используйте её ID для общих уведомлений
                </p>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', gridColumn: 'span 2' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>📅</span> Расписание проверок по регионам
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
                {/* Form to add new schedule */}
                <div style={{ borderRight: '1px solid var(--border)', paddingRight: '2rem' }}>
                  <h4 style={{ marginBottom: '1rem', color: '#8b949e' }}>Новая задача</h4>

                  <div className="form-group">
                    <label>Время</label>
                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Дни</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isSelected = newScheduleDays.includes(day);
                        return (
                          <div
                            key={day}
                            className={`region-tag ${isSelected ? 'active' : ''}`}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => setNewScheduleDays(prev =>
                              isSelected ? prev.filter(d => d !== day) : [...prev, day]
                            )}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Регионы</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {regions.map(r => {
                        const isSelected = newScheduleRegions.includes(r.subdomain);
                        return (
                          <div
                            key={r.subdomain}
                            className={`region-tag ${isSelected ? 'active' : ''}`}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => setNewScheduleRegions(prev =>
                              isSelected ? prev.filter(s => s !== r.subdomain) : [...prev, r.subdomain]
                            )}
                          >
                            {r.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button className="button" onClick={addSchedule} style={{ width: '100%', marginTop: '1rem' }}>
                    + Добавить профиль
                  </button>
                </div>

                {/* List of existing schedules */}
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#8b949e' }}>Активные профили</h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {schedules.map((s: any) => {
                      const days = JSON.parse(s.days);
                      const sRegions = JSON.parse(s.regions);
                      return (
                        <div key={s.id} className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <strong style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>{s.time}</strong>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {days.map((d: string) => (
                                  <span key={d} style={{ fontSize: '0.7rem', color: '#8b949e', border: '1px solid #333', padding: '2px 5px', borderRadius: '4px' }}>{d}</span>
                                ))}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#ccc', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              📍 {sRegions.map((sub: string) => regions.find(r => r.subdomain === sub)?.name || sub).join(', ')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => toggleSchedule(s)}
                              className="button"
                              style={{ padding: '5px 10px', fontSize: '0.8rem', background: s.enabled ? '#238636' : '#444' }}
                            >
                              {s.enabled ? 'Вкл' : 'Выкл'}
                            </button>
                            <button
                              onClick={() => deleteSchedule(s.id)}
                              className="button"
                              style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#da3633' }}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {schedules.length === 0 && <p style={{ color: '#555', fontStyle: 'italic' }}>Нет настроенных расписаний</p>}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <label>Срок хранения истории и скриншотов (дней)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.historyRetentionDays || 3}
                    onChange={e => setSettings({ ...settings, historyRetentionDays: parseInt(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '30px' }}>
                    {settings.historyRetentionDays || 3}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '5px' }}>
                  Все нарушения и фото старше этого срока будут автоматически удалены.
                </p>
              </div>

              <div style={{ marginTop: '2rem', padding: '1rem', background: settings.enabled ? 'rgba(35, 134, 54, 0.1)' : 'rgba(218, 54, 51, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}>
                <div style={{
                  width: '40px',
                  height: '24px',
                  background: settings.enabled ? 'var(--primary)' : '#444',
                  borderRadius: '20px',
                  position: 'relative',
                  transition: 'all 0.3s'
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '3px',
                    left: settings.enabled ? '19px' : '3px',
                    transition: 'all 0.3s'
                  }} />
                </div>
                <span style={{ fontWeight: 600, color: settings.enabled ? 'var(--foreground)' : '#8b949e' }}>
                  {settings.enabled ? 'Автоматика включена' : 'Автоматика выключена'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={saveSettings}
              style={{
                padding: '1rem 3rem',
                fontSize: '1.1rem',
                boxShadow: '0 4px 14px rgba(35, 134, 54, 0.4)'
              }}
            >
              🚀 Сохранить все изменения
            </button>
          </div>
        </section>
      )
      }

      {
        toast && (
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            {toast.message}
          </div>
        )
      }
    </main >
  );
}
