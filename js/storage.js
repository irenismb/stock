const LS_CART_KEY = "catalog_cart";
const LS_FILTERS_KEY = "catalog_filters";

export function getSavedFilters() {
  try {
    return JSON.parse(localStorage.getItem(LS_FILTERS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

export function saveFilters(filters) {
  localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(filters));
}

export function loadCart() {
  try {
    const saved = localStorage.getItem(LS_CART_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

export function saveCart(cart) {
  localStorage.setItem(LS_CART_KEY, JSON.stringify(cart));
}

export { LS_CART_KEY, LS_FILTERS_KEY };
