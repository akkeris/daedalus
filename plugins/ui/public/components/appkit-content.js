
class AppKitContent extends HTMLElement {
  constructor() {
    super();
  }

  get styles() {
    return `
    body {
      background-image:linear-gradient(to right, var(--random-bright-color-one) 0%, var(--random-bright-color-two) 100%);
      background-image:var(--body-background);
    }

    appkit-content a, appkit-content a:visited {
      text-decoration:none;
      color:var(--callout-color);
      font-weight:500;
    }

    appkit-content {
      display: block;
      border-radius: var(--border-radius-containers);
      box-shadow: 0 1px 4px rgba(51,51,51,0.30);
      background-color: white;
      box-sizing: border-box;
      max-width: 1024px;
      margin: 2em auto 0 auto;
      min-height: 500px;
      font-family: var(--font-text-family);
    }

    appkit-content > * {
      line-height:var(--font-text-line-height);
      font-size: var(--font-text-size);
      color: var(--font-text-color);
    }

    appkit-content > h1, 
    appkit-content > h2, 
    appkit-content > h3, 
    appkit-content > h4, 
    appkit-content > p,
    appkit-content > ol, 
    appkit-content > ul,
    appkit-content > div > h1, 
    appkit-content > div > h2, 
    appkit-content > div > h3, 
    appkit-content > div > h4, 
    appkit-content > div > p,
    appkit-content > div > ol, 
    appkit-content > div > ul
    {
      margin-right: 3rem;
      margin-left: 3rem;
    }

    appkit-content > hr {
      margin:2em 3rem;
    }

    appkit-content hr {
      border-bottom: 0;
      border-top: 1px solid lightgrey;
    }

    appkit-content h1 {
      font-size: var(--font-h1-size);
    }
    appkit-content h2 {
      font-size: var(--font-h2-size);
    }
    appkit-content h3 {
      font-size: var(--font-h3-size);
    }
    appkit-content h4 {
      font-size: var(--font-h4-size);
    }
    appkit-content h3,
    appkit-content h4 {
      padding-bottom:0.333em;
      border-bottom:1px solid var(--divider-color);
    }

    appkit-content h1, 
    appkit-content h2, 
    appkit-content h3, 
    appkit-content h4 {
      font-family: var(--font-main-family);
      font-weight: 300;
      color: var(--font-main-color);
      margin-top: 1em;
      margin-bottom: 0.333em
    }

    appkit-content p {
      margin-top: 1em;
      margin-bottom: 1em;
    }

    appkit-content > p:last-child,
    appkit-content > ol:last-child, 
    appkit-content > ul:last-child {
      padding-bottom: 3rem;
    }

    /* Alert, Warning and Tip Boxes */

    appkit-content p.alert,
    appkit-content p.tip {
      padding:1rem;
      text-shadow:var(--subtle-text-shadow);
    }

    appkit-content p.alert {
      border:1px solid var(--highlight-color);
      background-color:var(--highlight-background-color);
      font-size:var(--font-text-small-size);
      color:var(--font-main-color);
      border-radius:var(--border-radius);
    }

    appkit-content p.alert::before {
      content:"Alert:";
      font-weight:bold;
    }

    appkit-content p.tip {
      border:1px solid var(--callout-color);
      background-color:var(--callout-background-color);
      font-size:var(--font-text-small-size);
      color:var(--font-main-color);
      border-radius:var(--border-radius);
    }

    appkit-content p.tip::before {
      content:"Tip:";
      font-weight:bold;
    }

    appkit-content ol {
      counter-reset: li;
      list-style: none;
      padding-left: 0;
    }

    appkit-content ol > li {
      position: relative;
      padding-left: 40px;
      margin-bottom: 15px;    
      padding-top: 3px;
      padding-bottom: 3px;
    }

    appkit-content ol > li::before {
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

    appkit-content pre.command-line {
      font-family: Monaco,"DejaVu Sans Mono","Courier New",monospace;
      background-color:#333;
      color:white;
      font-weight:bold;
      padding:var(--font-text-small-size);
      font-size:var(--font-text-small-size);
      overflow-x:scroll;
    }

    appkit-content pre.command-line::before {
      content:"$";
      color:rgba(255,255,255,0.6);
      padding-right:0.5rem;
    }

    @media only screen and (max-width: 1024px) {
      appkit-content {
        border-radius:0px;
      }
    }
    `;
  }

  attributeChangedCallback(attr, oldValue, newValue) {
  }

  connectedCallback() {
    document.head.insertAdjacentHTML('afterbegin', `
      <style id="appkit-content-styles">
        ${this.styles}
      </style>
    `);
  }

  static get observedAttributes() {
    return [];
  }
}
customElements.define('appkit-content', AppKitContent);
