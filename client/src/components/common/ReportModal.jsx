import { useState } from 'react';
import { defaultAvatar } from '../../utils/helpers';
import { REPORT_REASONS } from '../../constants';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function ReportModal({ userId, userName, onClose }) {
    const { showToast } = useToast();
    const [details, setDetails] = useState('');
    const [selectedReason, setSelectedReason] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (reason) => {
        setSubmitting(true);
        try {
            await apiFetch('/api/report', {
                method: 'POST',
                body: JSON.stringify({ reported_id: userId, reason, details }),
            });
            showToast('Report submitted. Thank you! 🛡️', 'success');
            onClose();
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSubmitting(false);
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="report-modal">
                <h3 style={{ marginBottom: 4 }}>Report {userName}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Select a reason:
                </p>
                {REPORT_REASONS.map(r => (
                    <button
                        key={r}
                        className={`report-option ${selectedReason === r ? 'active' : ''}`}
                        onClick={() => !submitting && handleSubmit(r)}
                        disabled={submitting}
                    >
                        {r}
                    </button>
                ))}
                <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
