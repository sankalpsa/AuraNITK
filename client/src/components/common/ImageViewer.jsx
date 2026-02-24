import { useState } from 'react';

export default function ImageViewer({ url, onClose }) {
    if (!url) return null;

    return (
        <div className="image-viewer-overlay" onClick={onClose}>
            <img src={url} alt="Full size" />
            <button className="image-viewer-close" onClick={onClose}>✕</button>
        </div>
    );
}
