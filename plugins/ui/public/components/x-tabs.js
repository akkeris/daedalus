class Tab extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `
      x-tab, x-tab:not(.selected) > a[href], x-tab > a:visited {
        font-weight: 300;
        color:var(--font-text-color);
      }
      x-tab.selected, x-tab.selected > a[href], x-tab.selected > a:visited, x-tab:hover > a {
        color:var(--callout-color);
      }
      x-tab > a[href]:hover {
        color:var(--callout-color);
      }
      x-tab:hover {
        border-bottom:1px solid var(--callout-subtle-color);
        margin-bottom:-1px;
      }
      x-tab.selected {
        border-bottom:1px solid var(--highlight-link-color);
        margin-bottom:-1px;
      }
      x-tab {
        margin-right:4px;
        margin-left:4px;
      }
      x-tab > a {
        display: inline-block;
        padding: 0.75rem 10px;
      }
      x-tab:first-child {
        margin-left:-10px;
      }
      x-tab > a > i {
        opacity:0.7;
        margin-right:0.5em;
      }
      appkit-content > div {
        margin-right:0;
        margin-left:0;
      }
      .tab-panel {
        display:none;
        padding-bottom:3rem;
      }

      @media only screen and (max-width: 512px) {
        x-tab:first-child {
          margin-top:1rem;
        }

        x-tab {
          border-bottom:0;
          margin-bottom:0;
          width:100%;
          border-top:1px solid var(--divider-color);
        }

        x-tab.selected, x-tab:hover {
          border-bottom:0;
          margin-bottom:0;
        }

        x-tab, x-tab:first-child {
          margin-left:0px;
        }

        x-tab > a {
          padding: 0.5rem 0px;
        }
      }
    `;
  }

  parseTabName(content) {
    return content.substring(content.indexOf('#') + 1).toLowerCase();
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (this.children.length === 0) {
      return;
    }
    const name = this.parseTabName(this.querySelector('a').href);
    const panel = document.querySelector(`.tab-panel[name="${name}"]`);
    if (attr === 'selected' && newValue === null) {
      this.classList.remove('selected');
      panel && (panel.style.display = 'none');
    } else if (attr === 'selected') {
      this.classList.add('selected');
      panel && (panel.style.display = 'block');
    }
  }

  connectedCallback() {
    if(!this.parentNode.querySelector('x-tab[selected="true"]')) {
      this.parentNode.querySelector('x-tab').setAttribute('selected', 'true');
    }
    if (!document.querySelector('#x-tab-styles')) {
      document.head.insertAdjacentHTML('afterbegin', `
        <style id="x-tab-styles">
          ${this.styles}
        </style>
      `);
    }
    this.addEventListener('click', () => {
      let existing = this.parentNode.querySelector('x-tab[selected="true"]');
      if(existing) {
        existing.removeAttribute('selected');
      }
      this.setAttribute('selected', 'true');
    });
    setTimeout(() => {
      const name = this.parseTabName(this.querySelector('a').href);
      const dest = this.parseTabName(window.location.href);
      if (name === dest) {
        let existing = this.parentNode.querySelector('x-tab[selected="true"]');
        if(existing) {
          existing.removeAttribute('selected');
        }
        this.setAttribute('selected', 'true');
      } else {
        this.attributeChangedCallback('selected', null, this.getAttribute('selected'));
      }
    }, 250);
  }

  static get observedAttributes() {
    return ['selected'];
  }
}


class Tabs extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `
      nav-breadcrumb + x-tabs {
        border-top:0;
      }
      x-tabs {
        border-bottom: 1px solid var(--divider-color);
        margin:0 !important;
        display:flex;
      }

      @media only screen and (max-width: 512px) {
        x-tabs {
          flex-wrap: wrap;
        }
      }
    `;
  }

  connectedCallback() {
    document.head.insertAdjacentHTML('afterbegin', `
      <style id="x-tabs-styles">
        ${this.styles}
      </style>
    `);
  }

  static get observedAttributes() {
    return [];
  }
}

customElements.define('x-tabs', Tabs);
customElements.define('x-tab', Tab);
