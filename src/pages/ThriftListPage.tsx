import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Tag, DollarSign, Phone, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import { Button } from '../components/ui/Button';
import { DURATION } from '../design-system/animations';
import api from '../services/api';

const STEPS = [
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'details', label: 'Details', icon: Tag },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'contact', label: 'Contact', icon: Phone },
];

const CATEGORIES = ['Ethnic Wear', 'Western', 'Footwear', 'Accessories', 'Activewear', 'Fusion Wear', 'Luxury'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const CONDITIONS = [
  { value: 'like-new', label: 'Like New', desc: 'Worn once or twice, no visible wear' },
  { value: 'good', label: 'Good', desc: 'Minor wear, still looks great' },
  { value: 'fair', label: 'Fair', desc: 'Visible wear but fully functional' },
];

const slideVariants = {
  enter: { x: 100, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: DURATION.normal } },
  exit: { x: -100, opacity: 0, transition: { duration: DURATION.fast } },
};

export default function ThriftListPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  function canProceed(): boolean {
    switch (step) {
      case 0: return true; // Photos optional at this stage
      case 1: return !!(title && category && size && condition);
      case 2: return !!price && Number(price) > 0;
      case 3: return !!(city && whatsappNumber);
      default: return false;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post('/thrift', {
        title,
        brand,
        category,
        size,
        condition,
        price: Number(price),
        description,
        images,
        city,
        whatsappNumber,
      });
      navigate('/thrift');
    } catch {
      // Could show toast here
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageUrl() {
    const url = prompt('Paste image URL (Cloudinary or similar):');
    if (url && images.length < 5) {
      setImages([...images, url]);
    }
  }

  return (
    <>
      <SEOHead title="List an Item" description="Sell your pre-loved fashion on DripFeed" />
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <button onClick={() => navigate('/thrift')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0F0F1A] mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Thrift Store
        </button>
        <h1 className="text-2xl font-bold text-[#0F0F1A] mb-6">Sell Your Item</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex-1 flex items-center">
                <div className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                  isActive ? 'bg-[#0F0F1A] text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500',
                ].join(' ')}>
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={['flex-1 h-0.5 mx-1', isDone ? 'bg-green-500' : 'bg-gray-200'].join(' ')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={slideVariants} initial="enter" animate="center" exit="exit">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F0F1A]">Add photos</h2>
                <p className="text-sm text-gray-500">Up to 5 images (paste URLs for now)</p>
                <div className="grid grid-cols-3 gap-3">
                  {images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >×</button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button
                      onClick={handleImageUrl}
                      className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-[#0F0F1A] hover:text-[#0F0F1A] transition-colors"
                    >
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F0F1A]">Item details</h2>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Title *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Floral maxi dress" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Brand</label>
                  <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Zara" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Size *</label>
                    <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Select</option>
                      {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Condition *</label>
                    <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">Select</option>
                      {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Any details about the item..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F0F1A]">Set your price</h2>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Price (₹) *</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
                <p className="text-xs text-gray-400">Tip: Check similar items on the Thrift Store to price competitively.</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F0F1A]">Contact info</h2>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">City *</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">WhatsApp Number *</label>
                  <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91 9876543210" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20" />
                </div>
                <p className="text-xs text-gray-400">Buyers will contact you directly via WhatsApp.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : <div />}

          {step < 3 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={!canProceed()}>
              List Item
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

