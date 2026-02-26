﻿﻿import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary لحماية التطبيق من الانهيار عند فشل تحميل الخريطة أو Google Maps API.
 * يمنع ظهور الصفحة البيضاء ويعرض رسالة خطأ ودية بدلاً منها.
 */
export class MapErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('خطأ في مكون الخريطة:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#d32f2f',
                    background: '#fff3f3',
                    borderRadius: '12px',
                    border: '1px solid #ffcdd2',
                    margin: '20px',
                }}>
                    <h3>⚠️ تعذّر تحميل الخريطة</h3>
                    <p style={{ color: '#555' }}>
                        تأكد من أن مفتاح Google Maps API صحيح في ملف <code>.env</code>
                    </p>
                    <p style={{ fontSize: '12px', color: '#999' }}>
                        {this.state.error?.message}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: '10px 24px',
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginTop: '10px',
                        }}
                    >
                        إعادة المحاولة
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
