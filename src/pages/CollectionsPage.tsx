import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Share2, Trash2, ArrowLeft, Globe, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/format';
import { staggerChildren, staggerItem } from '../design-system/animations';
import api from '../services/api';

interface CollectionSummary {
  id: string;
  title: string;
  description: string;
  productCount: number;
  previewImages: string[];
  shareToken: string;
  isPublic: boolean;
}

interface CollectionProduct {
  productTitle: string;
  brand: string;
  imageUrl: string;
  platform: string;
  price: number;
  url: string;
  addedAt: string;
}

interface CollectionDetail {
  _id: string;
  title: string;
  description: string;
  products: CollectionProduct[];
  shareToken: string;
  isPublic: boolean;
}

export default function CollectionsPage() {
  const [searchParams] = useSearchParams();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState<CollectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Inline create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Shared view check
  const shareToken = searchParams.get('share');
  const sharedId = searchParams.get('id');

  useEffect(() => {
    if (shareToken && sharedId) {
      loadSharedCollection(sharedId, shareToken);
    } else {
      loadCollections();
    }
  }, [shareToken, sharedId]);

  async function loadCollections() {
    setLoading(true);
    try {
      const { data } = await api.get('/collections');
      setCollections(data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }

  async function loadSharedCollection(id: string, token: string) {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/collections/${id}`, { params: { shareToken: token } });
      setActiveCollection(data);
    } catch { /* empty */ }
    finally { setDetailLoading(false); }
  }

  async function openCollection(id: string) {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/collections/${id}`);
      setActiveCollection(data);
    } catch { /* empty */ }
    finally { setDetailLoading(false); }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/collections', { title: newTitle.trim(), description: newDesc.trim() });
      setCollections((prev) => [data, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
    } catch { /* empty */ }
    finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/collections/${id}`);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (activeCollection?._id === id) setActiveCollection(null);
    } catch { /* empty */ }
  }

  function handleShare(collection: CollectionSummary) {
    const url = `${window.location.origin}/collections?id=${collection.id}&share=${collection.shareToken}`;
    navigator.clipboard.writeText(url);
  }

  // Detail view
  if (activeCollection || detailLoading) {
    return (
      <>
        <SEOHead title={activeCollection?.title || 'Collection'} description="View collection" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton variant="text" width="60%" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" />)}
              </div>
            </div>
          ) : activeCollection && (
            <>
              <button
                onClick={() => setActiveCollection(null)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0F0F1A] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to collections
              </button>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#0F0F1A]">{activeCollection.title}</h1>
                  {activeCollection.description && (
                    <p className="text-sm text-gray-500 mt-1">{activeCollection.description}</p>
                  )}
                </div>
                <Badge variant={activeCollection.isPublic ? 'success' : 'default'} size="sm">
                  {activeCollection.isPublic ? <><Globe className="w-3 h-3 inline mr-1" />Public</> : <><Lock className="w-3 h-3 inline mr-1" />Private</>}
                </Badge>
              </div>

              {activeCollection.products.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">📦</p>
                  <p>This collection is empty</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-3 gap-4"
                  variants={staggerChildren}
                  initial="hidden"
                  animate="visible"
                >
                  {activeCollection.products.map((product, idx) => (
                    <motion.div key={idx} variants={staggerItem}>
                      <Card variant="outlined" padding="none" hover className="overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.productTitle} className="w-full h-36 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-2xl">🛍️</div>
                        )}
                        <div className="p-3">
                          {product.brand && <p className="text-xs text-gray-400 uppercase mb-0.5">{product.brand}</p>}
                          <p className="text-sm font-medium text-[#0F0F1A] line-clamp-2 mb-1">{product.productTitle}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[#0F0F1A]">{formatINR(product.price)}</span>
                            <Badge size="sm">{product.platform}</Badge>
                          </div>
                          {product.url && (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-2 block"
                            >
                              View on {product.platform}
                            </a>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <SEOHead title="Collections" description="Your curated fashion collections" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#0F0F1A]">Collections</h1>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(!showCreate)}>
            Create
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
            <input
              type="text"
              placeholder="Collection name"
              maxLength={50}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              maxLength={200}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} loading={creating}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" />)}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📚</p>
            <p className="font-medium text-[#0F0F1A]">No collections yet</p>
            <p className="text-sm mt-1">Create a collection to organise your favourite finds.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
          >
            {collections.map((collection) => (
              <motion.div key={collection.id} variants={staggerItem}>
                <Card
                  variant="outlined"
                  padding="none"
                  hover
                  className="overflow-hidden group"
                  onClick={() => openCollection(collection.id)}
                >
                  {/* Image mosaic preview */}
                  <div className="grid grid-cols-2 h-32">
                    {collection.previewImages.length > 0 ? (
                      collection.previewImages.slice(0, 4).map((img, i) => (
                        <img key={i} src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ))
                    ) : (
                      <div className="col-span-2 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-[#0F0F1A] text-sm truncate">{collection.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{collection.productCount} items</p>
                    <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShare(collection); }}
                        className="text-xs text-gray-400 hover:text-[#0F0F1A] flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3" /> Share
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(collection.id); }}
                        className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}

