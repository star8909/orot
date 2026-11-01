// Line-up interactions: a skin type filter that highlights the products
// suited to it, and an in-page cart that counts what has been added.
//   [data-skin-option="dry"]      a filter button; "all" clears the filter
//   [data-product] [data-skin]    a product and the skin types it suits
//   [data-add-to-cart="cream"]    adds that product; [data-cart-count] shows the total

export function setupSkinFilter(root) {
  const options = [...root.querySelectorAll('[data-skin-option]')];
  const products = [...root.querySelectorAll('[data-product]')];

  const select = (skin) => {
    for (const option of options) {
      option.setAttribute('aria-pressed', String(option.dataset.skinOption === skin));
    }
    for (const product of products) {
      const suits = skin === 'all' || product.dataset.skin.split(' ').includes(skin);
      product.dataset.match = String(suits);
    }
  };

  for (const option of options) {
    option.addEventListener('click', () => select(option.dataset.skinOption));
  }
  select('all');
}

export function setupCart(root) {
  const added = new Set();
  const counters = root.querySelectorAll('[data-cart-count]');
  const buttons = [...root.querySelectorAll('[data-add-to-cart]')];

  const render = () => {
    for (const counter of counters) counter.textContent = String(added.size);
    for (const button of buttons) {
      const inCart = added.has(button.dataset.addToCart);
      button.setAttribute('aria-pressed', String(inCart));
      button.dataset.label ??= button.textContent;
      button.textContent = inCart ? '담았어요 ✓' : button.dataset.label;
    }
  };

  // A second press takes the product back out, so the buttons act as toggles.
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const id = button.dataset.addToCart;
      if (added.has(id)) added.delete(id);
      else added.add(id);
      render();
    });
  }
  render();
}
