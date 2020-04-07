
class SideMenu extends HTMLElement {
  constructor() {
    super();
    document.head.insertAdjacentHTML('beforeend', `
      <style>
      ${this.styles}
      </style>
    `);
  }

  render() {
    if (!document.querySelector('.blackout')) {
      this.insertAdjacentHTML('afterend', '<div class="blackout"></div>');
    }
    document.querySelector('.blackout').addEventListener('click', () => {
      this.close();
    });
    this.insertAdjacentHTML('afterbegin', `
      <section>
        <button class="nav-sidemenu-button"><i class="fa fa-bars" aria-hidden="true"></i></button>
        <h3><strong>DAE</strong>DALUS<span class="title">${this.getAttribute('title') ? ` // ${this.getAttribute('title')}` : ''}</span></h3>
      </section>
    `);
    this.querySelector('.nav-sidemenu-button').addEventListener('click', () => {
      const sidemenus = document.querySelectorAll('nav-sidemenu');
      for (let i = 0; i < sidemenus.length; i++) {
        sidemenus[i].toggle();
      }
    });
  }

  open() {
    this.classList.add('open');
    document.querySelector('.blackout').classList.add('open');
  }

  close() {
    this.classList.remove('open');
    document.querySelector('.blackout').classList.remove('open');
  }

  toggle() {
    this.classList.toggle('open');
    document.querySelector('.blackout').classList.toggle('open');
  }

  connectedCallback() {
    this.render();
  }

  get styles() {
    return `
      nav-sidemenu {
        width:300px;
        background-color:white;
        position:fixed;
        left:-300px;
        top:0;
        bottom:0;
        transition:left 0.2s linear;
        z-index:5;
      }

      nav-sidemenu > section {
        display: flex;
        height: 56px;
        background: var(--body-background);
        box-sizing: border-box;
      }

      nav-sidemenu > ul {
        margin:0;
        padding:1rem 0 0 0;
      }

      nav-sidemenu > ul > li {
        list-style: none;
      }

      nav-sidemenu > ul > li > a:hover {
        background-color:rgba(0,0,0,0.05);
      }

      nav-sidemenu > ul > li > a {
        padding:1em 2em;
        display:inline-block;
        width:100%;
        color:var(--font-text-color);
        font-family:var(--font-text-family);
        font-size:16px;
        text-decoration:none;
        text-transform: uppercase;
        box-sizing: border-box;
      }

      nav-sidemenu > ul > li > a > i {
        margin-right:8px;
        font-size:16px;
      }

      .blackout {
        position:fixed;
        left:0;
        right:0;
        top:0;
        bottom:0;
        background-color:rgba(0,0,0,0.45);
        content:' ';
        opacity:0;
        transition:opacity 0.2s ease-in;
        z-index:-4;
      }

      .blackout.open {
        display:block;
        z-index:4;
        opacity:1;
      }

      nav-sidemenu.open {
        left:0;
      }

      nav-sidemenu > section > button.nav-sidemenu-button:hover {
        background: transparent;
        color: white;
      }

      nav-sidemenu > section > button.nav-sidemenu-button {
        color: white;
        border: 0;
        line-height: 0;
        font-size: 16px;
        margin-left: 1em;
        margin-right: 0.75em;
      }

      nav-sidemenu > section > h3 {
        color:white;
        font-size: 20px;
        text-transform: uppercase;
        font-weight: 200;
        font-family: var(--font-main-family);
        margin: auto 0;
      }

      nav-sidemenu > section > h3 > strong {
        color:white;
        font-weight: 500;
      }
    `;
  }
}

customElements.define('nav-sidemenu', SideMenu);
