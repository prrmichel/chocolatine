export const copyToClipboard = async (text: string): Promise<void> => {
  if (!text) return;

  try {
    if (window.epullrequest?.writeToClipboard) {
      window.epullrequest.writeToClipboard(text);
      return;
    }
  } catch {
    // fallback below
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallback below
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};
