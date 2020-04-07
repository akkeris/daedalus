class NavBreadCrumb extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `

      @media only screen and (max-width: 660px) {
        nav-breadcrumb > button.connected {
          display:none;
        }
      }

      nav-breadcrumb:last-child,
      nav-breadcrumb:first-child 
      {
        padding:0.5em 3rem;
      }

      nav-breadcrumb {
        display:flex;
        justify-content:space-between;
        padding-left:3rem;
        padding-right:3rem;
      }

      nav-breadcrumb:first-child
      {
        margin:0;
        border-bottom:1px solid var(--divider-color);
        border-top-left-radius: var(--border-radius-containers);
        border-top-right-radius: var(--border-radius-containers);
      }

      nav-breadcrumb:last-child {
        margin: 1.5em 0 0 0;
        border-top:1px solid var(--divider-color);
        border-bottom-left-radius: var(--border-radius-containers);
        border-bottom-right-radius: var(--border-radius-containers);
      }

      nav-breadcrumb:first-child, 
      nav-breadcrumb:last-child {
        background-image: var(--subtle-fading-background);
      }

      nav-breadcrumb:not(:last-child):not(:first-child) {
        border-top:1px solid var(--divider-color);
        border-bottom:1px solid var(--divider-color);
        /*background-color:var(--divider-background-color);*/
        margin:0;
      }

      nav-breadcrumb > ul {
        padding-left:0;
        flex-grow:1;
      }

      nav-breadcrumb > ul, nav-breadcrumb > ul > li {
        display:inline-block;
        font-size:var(--font-text-small-size);
        font-weight:bold;
        line-height:var(--font-text-line-height)
      }

      nav-breadcrumb.regular > ul, nav-breadcrumb.regular > ul > li {
        font-size:var(--font-text-size);
      }

      nav-breadcrumb button {
        background-color:white;
      }

      nav-breadcrumb.large > ul, nav-breadcrumb.large > ul > li {
        font-size:var(--font-text-large-size);
        font-weight:500;
      }

      nav-breadcrumb > ul > li {
        color:var(--font-subtle-color);
      }

      nav-breadcrumb > ul > li > a::after {
        margin-right:0.5em;
        margin-left:0.5em;
        content:" /";
        color:var(--font-subtle-color);
      }

      nav-breadcrumb > ul > li:last-of-type > a::after {
        color:var(--font-subtle-color);
      }

      nav-breadcrumb.large > ul > li > a::after {
        font-family:FontAwesome;
        content:" \\f105";
        font-weight:100;
      }

      nav-breadcrumb > ul > li > a,
      nav-breadcrumb > ul > li > a:visited {
        text-decoration:none;
        color:var(--highlight-link-color)
      }
    `;
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    this.classList.remove(oldValue);
    this.classList.add(newValue);
  }

  connectedCallback() {
    if (!document.getElementById('nav-breadcrumb-styles')) {
      document.head.insertAdjacentHTML('afterbegin', `
        <style id="nav-breadcrumb-styles">
          ${this.styles}
        </style>
      `);
    }
  }

  static get observedAttributes() {
    return ['size'];
  }
}
customElements.define('nav-breadcrumb', NavBreadCrumb);
