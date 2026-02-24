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
        <div className="ig-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ig-modal">
                {/* Header */}
                <div className="ig-modal-header">
                    <span className="ig-modal-header-spacer" />
                    <h3 className="ig-modal-title">Report</h3>
                    <button className="ig-modal-close" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Subtitle */}
                <div className="ig-modal-subtitle">
                    Why are you reporting {userName}?
                </div>

                {/* Options list */}
                <div className="ig-modal-list">
                    {REPORT_REASONS.map((reason, i) => (
                        <button
                            key={reason}
                            className="ig-modal-item"
                            onClick={() => handleSubmit(reason)}
                            disabled={submitting}
                        >
                            <span>{reason}</span>
                            <span className="material-symbols-outlined ig-modal-chevron">chevron_right</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
