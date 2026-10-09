import React, { useEffect, useMemo, useState } from "react";

function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [status, setStatus] = useState("Checking services...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError("");

    try {
      const [productsResponse, healthResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/health"),
      ]);

      if (!productsResponse.ok) {
        throw new Error(
          `Product API returned HTTP ${productsResponse.status}`
        );
      }

      const productData = await productsResponse.json();

      setProducts(productData);

      if (healthResponse.ok) {
        setStatus("All systems operational");
      } else {
        setStatus("API responding");
      }

      setLastUpdated(new Date());
    } catch (err) {
      setStatus("Backend unavailable");
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const categories = useMemo(() => {
    return ["All", ...new Set(products.map((product) => product.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const matchesSearch =
        normalizedSearch === "" ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const addToCart = (product) => {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });

    setCartOpen(true);
  };

  const decreaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const increaseQuantity = (productId) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  };

  const formatUpdatedTime = () => {
    if (!lastUpdated) {
      return "Waiting for API";
    }

    return lastUpdated.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="app">
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>

      <nav className="navbar">
        <a className="brand" href="#top" aria-label="CloudCart home">
          <span className="brand-mark">C</span>

          <span>
            <strong>CloudCart</strong>
            <small>Lite</small>
          </span>
        </a>

        <div className="nav-links">
          <a href="#catalog">Catalog</a>
          <a href="#platform">Platform</a>
        </div>

        <button
          className="cart-button"
          onClick={() => setCartOpen(true)}
          aria-label={`Open cart with ${cartCount} items`}
        >
          <span className="cart-icon">🛒</span>
          <span>Cart</span>

          {cartCount > 0 && (
            <span className="cart-badge">{cartCount}</span>
          )}
        </button>
      </nav>

      <header className="hero" id="top">
        <div className="hero-content">
          <div className="hero-copy">
            <div className="hero-label">
              <span className="pulse-dot"></span>
              CLOUD INFRASTRUCTURE DEMO
            </div>

            <h1>
              Shop the
              <span> cloud.</span>
              <br />
              Built to scale.
            </h1>

            <p className="hero-description">
              CloudCart Lite is a lightweight e-commerce workload designed
              to demonstrate real Cloud, DevOps and DevSecOps engineering.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#catalog">
                Explore catalog
                <span>→</span>
              </a>

              <button
                className="secondary-button"
                onClick={loadCatalog}
                disabled={loading}
              >
                <span className={loading ? "spin" : ""}>↻</span>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="hero-panel glass">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">LIVE PLATFORM</span>
                <h2>System status</h2>
              </div>

              <span className="live-pill">
                <span></span>
                LIVE
              </span>
            </div>

            <div className="status-main">
              <div className="status-orbit">
                <div className="status-core">✓</div>
              </div>

              <div>
                <strong>{status}</strong>
                <p>Spring Boot API + PostgreSQL</p>
              </div>
            </div>

            <div className="metric-grid">
              <div className="metric">
                <span>PRODUCTS</span>
                <strong>{products.length}</strong>
              </div>

              <div className="metric">
                <span>API</span>
                <strong>REST</strong>
              </div>

              <div className="metric">
                <span>DATABASE</span>
                <strong>PGSQL</strong>
              </div>

              <div className="metric">
                <span>UPDATED</span>
                <strong>{formatUpdatedTime()}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-glow-card">
          <div>
            <span>01</span>
            <strong>Frontend</strong>
            <small>React + Nginx</small>
          </div>

          <div className="flow-line"></div>

          <div>
            <span>02</span>
            <strong>Backend</strong>
            <small>Spring Boot</small>
          </div>

          <div className="flow-line"></div>

          <div>
            <span>03</span>
            <strong>Database</strong>
            <small>PostgreSQL</small>
          </div>
        </div>
      </header>

      <main>
        <section className="catalog-section" id="catalog">
          <div className="section-heading">
            <div>
              <span className="section-kicker">THE COLLECTION</span>

              <h2>Featured products</h2>

              <p>
                Simple products. Real APIs. Production-style infrastructure.
              </p>
            </div>

            <div className="catalog-summary">
              <strong>{filteredProducts.length}</strong>
              <span>shown</span>
            </div>
          </div>

          <div className="catalog-toolbar">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search products"
              />

              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="category-list">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`category-button ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-card">
              <div className="error-icon">!</div>

              <div>
                <strong>Unable to load catalog</strong>
                <p>{error}</p>
              </div>

              <button onClick={loadCatalog}>Retry</button>
            </div>
          )}

          {loading ? (
            <section className="product-grid">
              {[1, 2, 3, 4].map((item) => (
                <article className="product-card skeleton-card" key={item}>
                  <div className="skeleton skeleton-number"></div>
                  <div className="skeleton skeleton-category"></div>
                  <div className="skeleton skeleton-title"></div>
                  <div className="skeleton skeleton-price"></div>
                </article>
              ))}
            </section>
          ) : filteredProducts.length > 0 ? (
            <section className="product-grid">
              {filteredProducts.map((product, index) => (
                <article
                  className="product-card"
                  key={product.id}
                  style={{ "--delay": `${index * 70}ms` }}
                >
                  <div className="card-top">
                    <span className="product-number">
                      {String(product.id).padStart(2, "0")}
                    </span>

                    <span className="category-tag">
                      {product.category}
                    </span>
                  </div>

                  <div className="product-visual">
                    <div className="product-orb">
                      <span>
                        {product.category === "Laptops"
                          ? "⌘"
                          : product.category === "Audio"
                            ? "◉"
                            : product.category === "Keyboards"
                              ? "⌨"
                              : "▦"}
                      </span>
                    </div>
                  </div>

                  <div className="product-info">
                    <p>{product.category}</p>
                    <h3>{product.name}</h3>
                  </div>

                  <div className="product-footer">
                    <div>
                      <span>PRICE</span>
                      <strong>${product.price}</strong>
                    </div>

                    <button
                      className="add-button"
                      onClick={() => addToCart(product)}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      <span>+</span>
                      Add
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⌕</div>
              <h3>No products found</h3>
              <p>
                Try another search term or select a different category.
              </p>

              <button
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        <section className="platform-section" id="platform">
          <div className="platform-copy">
            <span className="section-kicker">ENGINEERED FOR LEARNING</span>

            <h2>
              Small application.
              <br />
              Serious infrastructure.
            </h2>

            <p>
              CloudCart Lite intentionally keeps the application simple so
              the engineering journey can focus on containers, Kubernetes,
              security, automation, observability, AWS and reliability.
            </p>
          </div>

          <div className="architecture-card glass">
            <div className="architecture-header">
              <span>REQUEST FLOW</span>
              <span className="architecture-status">● HEALTHY</span>
            </div>

            <div className="architecture-flow">
              <div className="architecture-node">
                <span>WEB</span>
                <strong>React</strong>
                <small>Nginx</small>
              </div>

              <div className="architecture-arrow">→</div>

              <div className="architecture-node">
                <span>API</span>
                <strong>Spring Boot</strong>
                <small>Java 21</small>
              </div>

              <div className="architecture-arrow">→</div>

              <div className="architecture-node">
                <span>DATA</span>
                <strong>PostgreSQL</strong>
                <small>Database</small>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-mark">C</span>

          <div>
            <strong>CloudCart Lite</strong>
            <small>Cloud / DevOps / DevSecOps learning platform</small>
          </div>
        </div>

        <div className="footer-tech">
          <span>React</span>
          <span>•</span>
          <span>Nginx</span>
          <span>•</span>
          <span>Spring Boot</span>
          <span>•</span>
          <span>PostgreSQL</span>
        </div>
      </footer>

      {cartOpen && (
        <div
          className="cart-overlay"
          onClick={() => setCartOpen(false)}
          role="presentation"
        >
          <aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-header">
              <div>
                <span className="section-kicker">YOUR CART</span>
                <h2>Shopping bag</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <div>🛒</div>
                <h3>Your cart is empty</h3>
                <p>Add a product from the catalog to get started.</p>

                <button
                  className="primary-button"
                  onClick={() => {
                    setCartOpen(false);
                    document
                      .getElementById("catalog")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Browse products
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-visual">
                        {item.category === "Laptops"
                          ? "⌘"
                          : item.category === "Audio"
                            ? "◉"
                            : item.category === "Keyboards"
                              ? "⌨"
                              : "▦"}
                      </div>

                      <div className="cart-item-info">
                        <strong>{item.name}</strong>
                        <span>${item.price} each</span>

                        <div className="quantity-controls">
                          <button
                            onClick={() => decreaseQuantity(item.id)}
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            onClick={() => increaseQuantity(item.id)}
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="cart-item-total">
                        <strong>${item.price * item.quantity}</strong>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>${cartTotal}</strong>
                  </div>

                  <p>
                    Demo checkout only. No payment processing is connected.
                  </p>

                  <button
                    className="checkout-button"
                    onClick={() =>
                      alert(
                        "Checkout is intentionally disabled in CloudCart Lite."
                      )
                    }
                  >
                    Continue to checkout
                    <span>→</span>
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;


