class SecurityService {
  static sanitizeString(inputString) {
    if (typeof inputString !== 'string') {
      return String(inputString);
    }
    return inputString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
  }

  static sanitizeData(inputData) {
    if (inputData === null || typeof inputData === 'undefined') {
      return '';
    }
    if (typeof inputData !== 'object') {
      return SecurityService.sanitizeString(String(inputData));
    }
    if (Array.isArray(inputData)) {
      return inputData.map(item => SecurityService.sanitizeData(item));
    }
    const sanitizedObject = {};
    for (const key in inputData) {
      if (Object.prototype.hasOwnProperty.call(inputData, key)) {
        sanitizedObject[key] = SecurityService.sanitizeData(inputData[key]);
      }
    }
    return sanitizedObject;
  }

  static sanitizeHtml(inputHtml) {
    if (typeof inputHtml !== 'string') return String(inputHtml);
    
    let clean = inputHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    clean = clean.replace(/\s+on[a-z]+=(["'])(.*?)\1/gi, '');
    clean = clean.replace(/\s+on[a-z]+=[^\s>]+/gi, '');
    clean = clean.replace(/href=(["'])javascript:[^"']*\1/gi, 'href="#"');
    clean = clean.replace(/href=javascript:[^\s>]+/gi, 'href="#"');
    return clean;
  }

  static sanitizeHtmlData(inputData) {
    if (inputData === null || typeof inputData === 'undefined') return '';
    if (typeof inputData !== 'object') return SecurityService.sanitizeHtml(String(inputData));
    if (Array.isArray(inputData)) return inputData.map(item => SecurityService.sanitizeHtmlData(item));
    const sanitizedObject = {};
    for (const key in inputData) {
      if (Object.prototype.hasOwnProperty.call(inputData, key)) {
        sanitizedObject[key] = SecurityService.sanitizeHtmlData(inputData[key]);
      }
    }
    return sanitizedObject;
  }
}