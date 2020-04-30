
class DropDown extends HTMLElement {
  constructor() {
    super();
  }

  get button() {
    return document.querySelector(this.getAttribute('target'));
  }

  static get observedAttributes() {
    return ['direction', 'target'];
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (this && attr === 'direction' && newValue === 'left') {
      this.classList.remove('right');
    } else if (this.domNode && attr === 'direction' && newValue === 'right') {
      this.classList.add('right');
    }
  }

  render() {
    this.button.addEventListener('click', (e) => {
      this.classList.toggle('open');
      if (this.classList.contains('open')) {
        this.focus();
      }
      e.preventDefault ? e.preventDefault() : null;
      e.stopPropogation ? e.stopPropogation() : null;
      e.preventBubble ? e.preventBubble() : null;
      return false;
    });
    this.addEventListener('focusout', (e) => {
      if (!this.contains(e.relatedTarget)) {
        this.classList.remove('open');
      }
    });
  }

  connectedCallback() {
    this.setAttribute('tabindex', '0');
    this.render();
  }

  static get styles() {
    return `
      x-dropdown {
        position:relative;
        outline:none;
      }

      x-dropdown > * {
        font-family:var(--font-main-family);
      }

      x-dropdown nav {
        cursor:pointer;
      }

      x-dropdown nav {
        display:none;
        position:absolute;
        background-color:white;
        min-width:195px;
        right: 0;
        top: calc(100% + 5px);
        border-radius:var(--border-radius);
        box-shadow:0 3px 12px rgba(27,31,35,0.15);
        z-index: 1;
      }
      
      x-dropdown.open nav {
        animation:show-pop-over .2s;
      }

      x-dropdown nav ul {
        list-style: none;
        padding:0;
        margin:0;
      }

      x-dropdown nav ul li {
        font-size: 14px;
        text-align: left;
        line-height: 21px;
      }

      x-dropdown li > a > i.fa {
        padding-right: 0.5rem;
      }

      x-dropdown nav > ul > li > a,
      x-dropdown nav > ul > li > p {
        padding: 6px 12px;
        display: block;
      }

      x-dropdown nav ul li a:hover, x-dropdown nav ul li a:focus {
        background-color:rgba(0,0,0,0.03);
      }

      x-dropdown.open::after {
        top: calc(100% - 3px);
        right: 10px;
        position: absolute;
        display: inline-block;
        vertical-align: sub;
        content: "";
        border: 4px solid;
        border-right-color: transparent;
        border-bottom-color: transparent;
        border-left-color: transparent;
        color: white;
        transition: color ease-in 0.2s;
        transform: rotateZ(180deg);
        z-index: 4;
      }

      x-dropdown:hover::after nav {
        color: white;
      }

      x-dropdown.open nav {
        display:inline-block;
      }

      x-dropdown ul li hr {
        margin:0;
      }

      x-dropdown::before nav {
        position: absolute;
        content: "";
        border: 8px solid transparent;
        border-bottom-color: white;
      }

      @keyframes show-pop-over {
        0% {
          transform: scale(0.5);
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
        }
      }

    `;
  }
}

document.head.insertAdjacentHTML('beforeend', `
  <style>
  ${DropDown.styles}
  </style>
`);
customElements.define('x-dropdown', DropDown);
