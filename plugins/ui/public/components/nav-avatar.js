
async function getUser(location) {
  const url = location || '/user';
  const headers = new Headers();
  headers.set('accept', 'application/json');
  try {
    const res = await fetch(url, { credentials: 'include', headers });
    return await res.json();
  } catch (e) {
    console.error('Response failed to decode to JSON.');
    console.error(e);
  }
}

class NavAvatar extends HTMLElement {
  constructor() {
    super();
    this.name = '';
    this.photo = '';
    // this.attachShadow({mode: 'open'})
  }

  static get observedAttributes() {
    return ['direction', 'user-api'];
  }

  get domNode() {
    return this.querySelector('.x-avatar');
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (this.domNode && attr === 'direction' && newValue === 'left') {
      this.domNode.classList.remove('right');
    } else if (this.domNode && attr === 'direction' && newValue === 'right') {
      this.domNode.classList.add('right');
    }
  }

  render() {
    // insert html
    this.innerHTML = `
    <form tabindex="0" class="x-avatar ${this.getAttribute('direction')}">
      <style>
        ${this.styles}
      </style>
      <img alt="${this.name}" src="${this.photo}">
      <nav>
        <ul>
          <li></li>
        </ul>
      </nav>
    </form>`;

    // attach events
    this.domNode.addEventListener('click', () => { this.domNode.classList.toggle('open'); });
    this.domNode.addEventListener('keyup', (e) => {
      if (e.keyCode === 32 || e.keyCode === 13 || e.key === 'Enter' || e.key === 'Space') {
        this.domNode.classList.toggle('open');
      }
    });
    this.domNode.addEventListener('keydown', (e) => {
      if (e.keyCode === 32 || e.key === 'Space') {
        e.preventDefault ? e.preventDefault() : null;
        e.stopPropogation ? e.stopPropogation() : null;
        e.preventBubble ? e.preventBubble() : null;
        return false;
      }
    });
    this.domNode.addEventListener('focusout', (e) => {
      if (!this.domNode.contains(e.relatedTarget)) {
        this.domNode.classList.remove('open');
      }
    });
  }

  connectedCallback() {
    (async function () {
      const data = await getUser(this.getAttribute('user-api'));
      this.name = data.displayName;
      this.photo = data.thumbnailPhoto;
      this.render();
    }.bind(this))();
  }

  get styles() {
    return `
      .x-avatar > * {
        font-family:var(--font-main-family);
      }

      .x-avatar {
        cursor:pointer;
      }

      .x-avatar nav {
        display:none;
        position:absolute;
        background-color:white;
        margin-top:35px;
        width:195px;
        margin-left:-38px;
        border-radius:3px;
        box-shadow:0 3px 12px rgba(27,31,35,0.15);
        z-index: 4;
        animation:show-pop-over .15s;
        transform-origin:top;
      }

      .x-avatar.right nav {
        margin-left:-180px;
      }

      .x-avatar.open nav {
        display:inline-block;
      }

      .x-avatar nav::before {
        position: absolute;
        content: "";
        border: 8px solid transparent;
        border-bottom-color: white;
        margin-top: -15px;
        margin-left: 15px;
      }

      .x-avatar.right nav::before {
        margin-left: calc(100% - 38px);
      }

      .x-avatar nav ul {
        list-style:none;
        margin:0;
        padding:0;
      }

      .x-avatar nav ul li {
        font-size:14px;
        text-align:left;
        line-height:21px;
      }

      .x-avatar nav ul li hr {
        border: 0;
        border-top: 1px solid rgb(225, 228, 232);
      }

      .x-avatar nav ul li:first-child {
        border-top-left-radius:3px;
        border-top-right-radius:3px;
        border-bottom:1px solid #e1e4e8;
        padding-top:5px;
        padding-bottom:5px;
        margin-bottom:5px;
      }

      .x-avatar nav ul li:first-child a {
        color:var(--font-main-color);
      }

      .x-avatar nav ul li:last-child {
        margin-bottom:10px;
      }

      .x-avatar nav ul li:first-child strong {
        font-weight:600;
      }

      .x-avatar nav ul li a {
        color:var(--font-main-color);
        font-family:var(--font-text-family);
        padding:5px 15px;
        display:block;
        text-decoration:none;
      }

      .x-avatar nav ul li:hover, .x-avatar nav ul li:hover a, .x-avatar nav ul li a:focus {
        background-color:var(--highlight-color);
        color:white;
      }

      .x-avatar::after {
        margin-top: 0.75em;
        margin-left:5px;
        display: inline-block;
        vertical-align: sub;
        content: "";
        border: 4px solid;
        border-right-color: transparent;
        border-bottom-color: transparent;
        border-left-color: transparent;
        color: rgba(255,255,255,0.75);
        transition:color ease-in 0.2s;
      }

      .x-avatar:hover::after {
        color: white;
      }

      .x-avatar img {
        width:20px;
        height:20px;
        border-radius: 3px;
        vertical-align: middle;
      }

      @keyframes show-avatar {
        0% {
          transform: scale(0.5);
        }
        50% {
          transform: scale(1.1);
        }
        100% {
          transform: scale(1);
        }
      }
    `;
  }
}

customElements.define('nav-avatar', NavAvatar);
