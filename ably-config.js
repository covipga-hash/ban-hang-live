// Host bán hàng — Ably subscribe-only key (public by design: chỉ được
// subscribe kênh ban-hang-live, không publish được).
// Publish key nằm trong .env trên VM, KHÔNG nhúng vào trang tĩnh.
window.ABLY_CONFIG = {
  key: 'GVuKBw.EiNCgw:m7ZW3EiHhVyQJhcbgL1tdJ2CySfI6YeSgXbgZBSvzUg',
  channel: 'ban-hang-live',
};
