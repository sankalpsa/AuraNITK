import { useState } from 'react';
import { REPORT_REASONS } from '../../constants';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function ReportModal({ userId, userName, onClose }) {
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (reason) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await apiFetch('/api/report', {
                method: 'POST',
                body: JSON.stringify({ reported_id: userId, reason }),
            });
            showToast('Report submitted. Thank you! 🛡️', 'success');
            onClose();
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSubmitting(false);
    };

    return (
        <div className="modal-backdrop-aura" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-aura">
                <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                    <h3 className="font-serif" style={{ margin: 0 }}>Safety Report</h3>
                    <button className="btn-icon" onClick={onClose} style={{ background: 'none' }}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div style={{ padding: '20px 25px', fontSize: '0.9rem', opacity: 0.6 }}>
                    Why are you flags highlighting {userName}?
                </div>

                <div className="ig-modal-list">
                    {REPORT_REASONS.map((reason) => (
                        <button
                            key={reason}
                            className="modal-item-aura"
                            onClick={() => handleSubmit(reason)}
                            disabled={submitting}
                        >
                            <span>{reason}</span>
                            <span className="material-symbols-rounded" style={{ fontSize: '18px', opacity: 0.5 }}>chevron_right</span>
                        </button>
                    ))}
                </div>

                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', textAlign: 'center', fontSize: '0.75rem', opacity: 0.4 }}>
                    AURA SAFETY PROTOCOL • SECURE SUBMISSION
                </div>
            </div>
        </div>
    );
}
