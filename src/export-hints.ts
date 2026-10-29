/** 竖/横构图 class 与安全区标记（文案落在上下安全区由 CSS 控制） */
export function applyExportHints(root: HTMLElement): void {
  const apply = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = w / h;
    const portrait = ratio <= 0.75; // ~9:16 = 0.5625；放宽到 0.75
    root.classList.toggle('portrait', portrait);
    root.classList.toggle('landscape', !portrait);
    root.classList.add('export-safe');
    root.style.setProperty('--safe-top', 'max(4.5vh, env(safe-area-inset-top, 0px))');
    root.style.setProperty(
      '--safe-bottom',
      'max(4.5vh, env(safe-area-inset-bottom, 0px))',
    );
  };
  apply();
  window.addEventListener('resize', apply);
}
