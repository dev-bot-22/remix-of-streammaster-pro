declare module "*.css";
declare module "*.scss";
declare module "katex/dist/contrib/auto-render" {
  const renderMathInElement: (...args: any[]) => void;
  export default renderMathInElement;
}
declare module "shaka-player/dist/shaka-player.compiled" {
  const shaka: any;
  export default shaka;
}
declare module "js-cookie";
