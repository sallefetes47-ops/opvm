﻿﻿import ArabicReshaper from "arabic-reshaper";

/**
 * Fixes Arabic text for PDF rendering by:
 * 1. Reshaping characters (joining disconnected letters).
 * 2. Reversing the string for RTL display (bypassing jsPDF BIDI issues).
 * 3. Converting Eastern numerals to Western numerals.
 */
export function fixArabicText(text: string | undefined | null): string {
    if (!text) return "";

    // 1. Convert to string if numeric
    let str = String(text);

    try {
        // 2. Convert Eastern (Hindi) numerals to Western numerals
        const easternToWestern: Record<string, string> = {
            '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
            '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
        };
        str = str.replace(/[٠-٩]/g, (d) => easternToWestern[d] || d);

        // 3. Reshape Arabic characters using the correct method
        // Check if ArabicReshaper is available and has the method
        if (ArabicReshaper && typeof ArabicReshaper.convertArabic === 'function') {
            str = ArabicReshaper.convertArabic(str);
        } else {
            console.warn("ArabicReshaper.convertArabic is not a function", ArabicReshaper);
        }
    } catch (error) {
        console.error("Error reshaping Arabic text:", error);
        // Fallback: return original text (or partially processed) so PDF doesn't crash
    }

    // 4. Reverse the string for RTL rendering in jsPDF
    // We split by lines to handle multi-line text correctly
    return str.split('\n').map(line => {
        return line.split('').reverse().join('');
    }).join('\n');
}
