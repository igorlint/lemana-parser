'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Product {
  sku: string;
  name: string;
}

interface Region {
  name: string;
  subdomain: string;
}

interface PriceData {
  [key: string]: string; // sku_subdomain: price
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(0);

  const [uploading, setUploading] = useState(false);

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
    }
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
    setParsingProgress(0);

    const batchSize = 5;
    const totalToParse = products.length * selectedRegions.length;
    let completedCount = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batchSkus = products.slice(i, i + batchSize).map(p => p.sku);

      try {
        const res = await axios.post('/api/parse', {
          skus: batchSkus,
          regions: selectedRegions
        });

        const newPrices: PriceData = {};
        res.data.forEach((item: any) => {
          newPrices[`${item.sku}_${item.region}`] = item.price;
        });

        setPrices(prev => ({ ...prev, ...newPrices }));
        completedCount += batchSkus.length * selectedRegions.length;
        setParsingProgress(Math.floor((completedCount / totalToParse) * 100));
      } catch (error) {
        console.error('Error parsing batch', error);
      }
    }

    setLoading(false);
  };

  return (
    <main>
      <header>
        <h1>Lemana Pro Price Parser</h1>
      </header>

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
        <div style={{ marginTop: '1.5rem' }}>
          <button onClick={startParsing} disabled={loading || selectedRegions.length === 0}>
            {loading ? `Парсинг... ${parsingProgress}%` : 'Обновить цены'}
          </button>
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
                <th>Артикул (Код партнера)</th>
                <th>Наименование</th>
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
                  {selectedRegions.map(region => {
                    const priceKey = `${product.sku}_${region.subdomain || 'moscow'}`;
                    const price = prices[priceKey];
                    return (
                      <td key={region.subdomain || 'moscow'}>
                        {price ? (
                          <span className={price === '0' ? 'badge badge-error' : 'badge badge-success'}>
                            {price === '0' ? 'Ошибка' : `${price} ₽`}
                          </span>
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
    </main>
  );
}
