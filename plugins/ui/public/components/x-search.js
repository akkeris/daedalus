
async function search_content(location, term) {
  let url = location || '/api/search';
  if (url.includes('{term}')) {
    url = url.replace(/\{term\}/gi, encodeURIComponent(term));
  }
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

class Search extends HTMLElement {
  constructor() {
    super();
    document.head.insertAdjacentHTML('beforeend', `
      <style>
      ${this.styles}
      </style>
    `);
  }

  static get observedAttributes() {
    return ['placeholder', 'no-results', 'title', 'location', 'icon', 'description', 'search-api'];
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    if (oldValue !== newValue) this.renderContainer();
  }

  renderContainer() {
    const ptext = this.getAttribute('placeholder') || 'Search';
    this.innerHTML = `
      <input type="search" placeholder="${ptext}"/>
      <ul class="results">
      </ul>
    `;

    this.results = this.querySelector('.results');
    this.search = this.querySelector('input[type="search"]');

    this.results.addEventListener('focusout', (e) => {
      if (!this.contains(e.relatedTarget)) {
        this.results.classList.remove('open');
      }
    });

    // on clear..
    var interval = null;
    this.search.addEventListener('input', (async () => {
      // debounce the type-ahead on a 150ms trigger.
      if(interval) {
        clearInterval(interval);
      }
      interval = setTimeout(async () => {
        interval = null;
        if (!this.search || !this.search.value || this.search.value.length < 3) {
          this.results.classList.remove('open');
          return;
        }
        this.data = await search_content(this.getAttribute('search-api'), this.search.value);
        // todo: do not use docs like this
        // todo: handle searching by js and searching by param/body
        // todo: support parameters
        if (!this.data.length && Object.keys(this.data).length === 1) {
          this.data = this.data[Object.keys(this.data)[0]];
        }
        const title = this.getAttribute('title') || 'title';
        this.data = this.data.filter((x) => x[title].toLowerCase().indexOf(this.search.value.toLowerCase()) !== -1);
        this.render();
      }, 200);
    }));
  }

  render() {
    if (this.data && this.data.length > 0) {
      this.results.innerHTML = this.data.map((x) => `
        <li>
          <a tabindex="1" href="${x[this.getAttribute('location')] || x.location}">
            <h5>
              ${x.icon ? `<img src="/${x.icon}" />` : ''}
              ${x[this.getAttribute('title')] || x.title}
            </h5>
            ${x[this.getAttribute('description') || 'text'] ? `<p>${x[this.getAttribute('description') || 'text'] || ''}</p>` : ''}
          </a>
        </li>
      `).join('\n');
    } else {
      this.results.innerHTML = `<li class="none">${this.getAttribute('no-results') || "Can't find any matching results"}</li>`;
    }
    this.results.classList.add('open');
    this.results.querySelector('a').focus();
  }

  connectedCallback() {
    this.renderContainer();
  }

  get styles() {
    return `
      nav-bar > x-search {
        margin: 0 10em 0 5em;
      }

      x-search.dark {
        background-color: rgba(0,0,0,0.3);
        color:white;
      }

      x-search.dark input {
        color:white;
      }

      x-search.dark::before {
        color: rgba(255,255,255,0.3);
      }

      x-search:not(.dark) {
        background-color: rgba(0,0,0,0.0125);
        box-shadow: 0px 0.5px 0.5px 1px rgba(0,0,0,0.125);
      }

      input[type="search"]::placeholder {
        color: #999;
      }

      x-search {
        display: flex;
        border-radius: 3px;
        position:relative;
        text-align: center;
      }

      x-search * {
        font-family: var(--font-main-family);
      }

      x-search {
        border-radius: var(--border-radius);
      }

      x-search > input {
        align-self: center;
        flex-grow:1;
        padding: 0.5em 2em 0.5em 0.5em;
        -webkit-appearance: none;
        border: 0;
        background-color: transparent;
        font-size:var(--font-text-size);
        margin:0;
        outline:0;
      }

      x-search::before {
        content: "\\f002";
        font-family: FontAwesome;
        align-self: center;
        padding-left:0.5em;
      }

      x-search > input::placeholder {
        color: rgba(255,255,255,0.7);
        font-size:var(--font-text-size);
      }

      x-search > .results {
        display:none;
        box-shadow:0 3px 12px rgba(27,31,35,0.15);
      }

      x-search > .results.open {
        top:100%;
        left:0;
        position:absolute;
        list-style: none;
        margin: 0.5em 0 0 0;
        border-radius:var(--border-radius);
        padding: 0;
        background-color:white;
        display:block;
        width:100%;
        transform-origin:top;
        animation:show-search 0.2s;
        max-height:60vh;
        overflow-y:auto;
        overflow-x:hidden;
        z-index: 4;
      }

      x-search > .results.open > li {
        margin: 0;
        border-bottom:1px solid var(--divider-color);
      }

      x-search > .results.open > li, 
      x-search > .results.open > li * {
        font-size: var(--font-text-small-size);
        color: var(--font-text-color);
      }

      x-search > .results.open > li > a {
        display: block;
        text-decoration:none;
        text-align: left;
        padding: 0.75em 1em;
        margin: 2px 4px;
      }

      x-search > .results.open > li > a > h5 {
        font-weight: 600;
        align-items: center;
        display: flex;
        margin: 0;
        padding: 0; 
        color: var(--callout-color);
      }

      x-search > .results.open > li > a > h5 > img {
        max-width:1rem;
        margin-right:0.5rem;
      }

      x-search > .results.open > li > a > p {
        display: block;
        overflow-y: hidden;
        text-overflow: ellipsis;
        text-align: left;
        padding: 0.5em 0 0 0;
        margin: 0 0 0 0;
      }

      x-search > .results.open > li.none {
        font-weight: 600;
        padding:1rem;
      }

      @keyframes show-search {
        0% {
          transform: scaleY(0.5);
        }
        50% {
          transform: scaleY(1.2);
        }
        100% {
          transform: scaleY(1);
        }
      }
    `;
  }
}

customElements.define('x-search', Search);
