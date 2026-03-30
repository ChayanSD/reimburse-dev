export function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /WebKit/i.test(userAgent);
  const isThirdPartyIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

  return isIOSDevice && isWebKit && !isThirdPartyIOSBrowser;
}

export function submitPostDownload(
  action: string,
  fields: Record<string, string>,
  target = "_blank"
): void {
  if (typeof document === "undefined") {
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.target = target;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.submit();
  }

  window.setTimeout(() => {
    form.remove();
  }, 1000);
}
