
class AppKitApp extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `
    body {
      background-image:linear-gradient(to right, var(--random-bright-color-one) 0%, var(--random-bright-color-two) 100%);
      background-image:var(--body-background);
    }

    appkit-app a, appkit-app a:visited {
      text-decoration:none;
      color:var(--callout-color);
      font-weight:500;
    }

    appkit-app {
      min-width:500px;
      display: block;
      box-shadow: 0 1px 4px rgba(51,51,51,0.30);
      background-color: white;
      box-sizing: border-box;
      max-width: 100%;
      margin: 4px 0;
      min-height: 500px;
      font-family: var(--font-text-family);
    }

    appkit-app > * {
      line-height:var(--font-text-line-height);
      font-size: var(--font-text-size);
      color: var(--font-text-color);
    }

    appkit-app > *:not(.fullwidth)
    {
      padding-left:calc(50% - 512px);
      padding-right:calc(50% - 512px);
    }

    appkit-app > hr {
      margin:2em 3rem;
    }

    appkit-app hr {
      border-bottom: 0;
      border-top: 1px solid lightgrey;
    }

    appkit-app h1 {
      font-size: var(--font-h1-size);
    }
    appkit-app h2 {
      font-size: var(--font-h2-size);
    }
    appkit-app h3 {
      font-size: var(--font-h3-size);
    }
    appkit-app h4 {
      font-size: var(--font-h4-size);
    }
    appkit-app h3,
    appkit-app h4 {
      padding-bottom:0.333em;
      border-bottom:1px solid var(--divider-color);
    }

    appkit-app h1, 
    appkit-app h2, 
    appkit-app h3, 
    appkit-app h4 {
      font-family: var(--font-main-family);
      font-weight: 300;
      color: var(--font-main-color);
      margin-top: 1em;
      margin-bottom: 0.333em
    }

    appkit-app p {
      margin-top: 1em;
      margin-bottom: 1em;
    }

    appkit-app > p:last-child,
    appkit-app > ol:last-child, 
    appkit-app > ul:last-child {
      padding-bottom: 3rem;
    }

    /* Alert, Warning and Tip Boxes */

    appkit-app p.alert,
    appkit-app p.tip {
      padding:1rem;
      text-shadow:var(--subtle-text-shadow);
    }

    appkit-app p.alert {
      border:1px solid var(--highlight-color);
      background-color:var(--highlight-background-color);
      font-size:var(--font-text-small-size);
      color:var(--font-main-color);
      border-radius:var(--border-radius);
    }

    appkit-app p.alert::before {
      content:"Alert:";
      font-weight:bold;
    }

    appkit-app p.tip {
      border:1px solid var(--callout-color);
      background-color:var(--callout-background-color);
      font-size:var(--font-text-small-size);
      color:var(--font-main-color);
      border-radius:var(--border-radius);
    }

    appkit-app p.tip::before {
      content:"Tip:";
      font-weight:bold;
    }

    appkit-app ol {
      counter-reset: li;
      list-style: none;
      padding-left: 0;
    }

    appkit-app ol > li {
      position: relative;
      padding-left: 40px;
      margin-bottom: 15px;    
      padding-top: 3px;
      padding-bottom: 3px;
    }

    appkit-app ol > li::before {
      content: counter(li);
      counter-increment: li;
      color:var(--font-text-color);
      position: absolute;
      top: 0;
      left: 0;
      padding: 0 15px 0 0;
      border-right: 2px solid var(--divider-color);
      height: 100%;
      width: 8px;
      font-weight:500;
    }

    appkit-app pre.command-line {
      font-family: Monaco,"DejaVu Sans Mono","Courier New",monospace;
      background-color:#333;
      color:white;
      font-weight:bold;
      padding:var(--font-text-small-size);
      font-size:var(--font-text-small-size);
      overflow-x:scroll;
    }

    appkit-app pre.command-line::before {
      content:"$";
      color:rgba(255,255,255,0.6);
      padding-right:0.5rem;
    }

    @media only screen and (max-width: 1024px) {
      appkit-app > *:not(.fullwidth)
      {
        padding-left:1em;
        padding-right:1em;
      }

    }
    `;
  }

  attributeChangedCallback(attr, oldValue, newValue) {
  }

  connectedCallback() {
    document.head.insertAdjacentHTML('afterbegin', `
      <style id="appkit-app-styles">
        ${this.styles}
      </style>
    `);
  }

  static get observedAttributes() {
    return [];
  }
}
customElements.define('appkit-app', AppKitApp);
