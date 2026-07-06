import { useState } from 'react';
import { Plus, FolderHeart } from 'lucide-react';
import Modal from '../ui/Modal';
import type { ProductData } from '../../types/product';

export interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  product: ProductData;
}

export function CollectionModal({ open, onClose, product }: CollectionModalProps) {
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Collections API doesn't exist yet — show "coming soon" state
  // When ready, fetch from GET /api/collections and POST to add product

  function handleSave() {
    // Future: POST /api/collections/:id/products with product data
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Save to Collection" size="sm">
      <div className="space-y-4">
        {/* Coming soon state */}
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <FolderHeart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium mb-1">Collections coming soon</p>
          <p className="text-xs text-gray-400">
            For now, "{product.title}" will be saved to your default wishlist.
          </p>
        </div>

        {/* Create new collection (UI ready for future) */}
        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors w-full px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Create new collection
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoFocus
            />
            <button
              onClick={() => setShowInput(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full bg-[#051F45] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#051F45]/90 transition-colors"
        >
          Save to Wishlist
        </button>
      </div>
    </Modal>
  );
}

export default CollectionModal;
