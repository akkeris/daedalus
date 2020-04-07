class NavBar extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `

    @media only screen and (max-width: 1024px) {
      nav-bar {
        padding-left: 16px !important;
        padding-right: 16px !important;
        box-sizing: border-box !important;
      }
      nav-bar > x-search {
        margin:0 5em !important;
      }
    }

    @media only screen and (max-width: 660px) {
      nav-bar > x-search {
        display:none !important;
      }
      nav-bar > button {
        flex-grow:0 !important;
        flex-shrink:0 !important;
      }
      nav-bar > h3 {
        flex-grow:1 !important;
        flex-shrink:0 !important;
      }
    }
    
    nav-bar {
      display:flex;
      align-items:center;
      width:100%;
      height: 56px;
      background-color: #3c4146;
      border-bottom-color: #202326;
      max-width:1024px;
      padding-left: calc( (100% - 1024px)/2 );
      padding-right: calc( (100% - 1024px)/2 );
      box-sizing: content-box;
      justify-content: space-between;
    }

    nav-bar > button.nav-sidemenu-button.hide {
      display:none
    }

    button.nav-sidemenu-button:hover {
      background: transparent;
    }

    button.nav-sidemenu-button {
      color: white;
      border: 0;
      line-height: 0;
      font-size: 16px;
      margin-right: 0.75em;
    }
    
    nav-bar > h3 {
      color:#cdcdcd;
      font-size: 20px;
      text-transform: uppercase;
      font-weight: 200;
      margin: 0;
      font-family: var(--font-main-family);
    }
    nav-bar > h3 > strong {
      color:white;
      font-weight: 500;
    }
    nav-bar > * {
      flex-direction: row
    }
    nav-bar > *:not(:last-child):not(:first-child):not(h3) {
      flex-grow:1;
    }
    nav-bar > *:last-child, nav-bar > *:first-child, nav-bar > h3 {
      flex-shrink:1;
    }
    `;
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (attr === 'title') {
      if (this.querySelector('.title')) {
        this.querySelector('.title').innerHTML = ` // ${newValue}`;
      }
    } else if (attr === 'sidemenu') {
      const button = this.querySelector('button.nav-sidemenu-button');
      if (!button) {
        return;
      }
      if (newValue !== 'true') {
        button.classList.add('hide');
      } else {
        button.classList.remove('hide');
      }
    }
  }

  connectedCallback() {
    document.head.insertAdjacentHTML('afterbegin', `
      <style id="nav-bar-styles">
        ${this.styles}
      </style>
    `);
    this.insertAdjacentHTML('afterbegin', `
      <button class="nav-sidemenu-button ${this.getAttribute('sidemenu') === 'true' ? '' : 'hide'}"><i class="fa fa-bars" aria-hidden="true"></i></button>
      <h3><strong>DAE</strong>DALUS<span class="title">${this.getAttribute('title') ? ` // ${this.getAttribute('title')}` : ''}</span></h3>
    `);

    this.querySelector('.nav-sidemenu-button').addEventListener('click', () => {
      const sidemenus = document.querySelectorAll('nav-sidemenu');
      for (let i = 0; i < sidemenus.length; i++) {
        sidemenus[i].toggle();
      }
    });
  }

  static get observedAttributes() {
    return ['title', 'sidemenu'];
  }
}
customElements.define('nav-bar', NavBar);
