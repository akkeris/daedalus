class AkkerisAddons extends HTMLElement {
  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['app'];
  }

  attributeChangedCallback(attr, oldValue, newValue) {
    this.render().catch((err) => console.error(err));
  }

  async render() {
    this.addons = await (await fetch(`/api/apps/${this.getAttribute('app')}/addons`)).json();
    this.addons = await Promise.all(this.addons.map(async (addon) => {
      const [addon_info, addon_service] = await Promise.all((await Promise.all([
        fetch(`/api/apps/${this.getAttribute('app')}/addons/${addon.id}`),
        fetch(`/api/addon-services/${addon.addon_service.id}`),
      ])).map((x) => x.json()));
      addon.config_vars = addon_info.config_vars;
      addon.addon_service = addon_service;
      return addon;
    }));
    console.log(this.addons);
    this.innerHTML = `
			<style>
			${this.styles}
			</style>
			<ul>
			${this.addons.map((addon) => `<li>
					<img class="addon-info service-image" src="${addon.addon_service.image_url}" /> 
					<span class="addon-info service-name">${addon.addon_service.human_name}</span>
					<span class="addon-info addon-name">
						Attached as ${Object.keys(addon.config_vars).reduce((agg, x, i) => `${agg}<pre><code>${x}</code></pre>`, '')}
						<button class="${addon.name}-attachments secondary inline"><i class="fas fa-info-circle"></i></button>
						<x-dropdown target=".${addon.name}-attachments">
							<nav>
								<ul>
									<li>
										<p>
											<strong>${addon.name}</strong> is ${addon.primary ? 'owned by' : 'attached to'} this app through
											the environment variables ${Object.keys(addon.config_vars).join(', ')}
										</p>
									</li>
								</ul>
							</nav>
						</x-dropdown>
					</span>
					<span class="addon-info addon-price">
						${Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.billed_price.cents / 100)}/${addon.billed_price.unit}
					</span>
					<span class="addon-info addon-actions">
						<button class="${addon.name}"><i class="fas fa-ellipsis-h"></i></button>
						<x-dropdown target=".${addon.name}">
							<nav>
								<ul>
									<li><a tabindex="0" href="#"><i class="fas fa-edit" aria-hidden="true"></i> Modify Plan</strong></a></li>
									<li><hr border="0"></hr></li>
									<li><a tabindex="0" href="https://docs.akkeris.io/addons/${addon.addon_service.name}.html" target="_blank"><i class="fas fa-file" aria-hidden="true"></i> View Plan in Docs</a></li>
									<li><hr border="0"></hr></li>
									<li><a class="danger" tabindex="0" href="#"><i class="fas fa-times-circle" aria-hidden="true"></i> Delete Add-on</a></li>
								</ul>
							</nav>
						</x-dropdown>
					</span>
				</li>`).join('\n')}
			</ul>
		`;
  }

  async connectedCallback() {
  }

  get styles() {
    return `
		@media only screen and (max-width: 660px) {
			akkeris-addons > ul  > li > .addon-info.addon-price {
				display:none;
			}
		}

		akkeris-addons .addon-name x-dropdown nav {
			width: 300px;
		}

		akkeris-addons {
			min-height:3rem;
		}

		akkeris-addons > ul {
			list-style: none;
			margin: 0px;
			padding: 0px;
			width:100%;
		}

		akkeris-addons > ul > li  {
			width:100%;
		}

		akkeris-addons > ul > li:not(:first-child) {
			border-top: 1px solid rgba(0,0,0,0.1);
		}

		akkeris-addons > ul > li:hover {
			background-color: rgba(0,0,0,0.025);
		}

		akkeris-addons > ul > li {
			padding: 10px 0px;
			display: flex;
			box-sizing: border-box;
		}

		akkeris-addons > ul > li > * {
		    margin-top: auto;
		    margin-bottom: auto;
		}

		akkeris-addons > ul > li > .service-image {
			max-height: 28px;
			max-width: 28px;
			margin-right:1rem;
		}

		akkeris-addons > ul > li >.addon-info.service-name {
			flex-grow: 1;
    		max-width: 25%;
		}

		akkeris-addons > ul > li > .addon-info.addon-name {
			flex-grow: 2;
			padding-right: 1rem;
		}

		akkeris-addons > ul > li > .addon-info.addon-price {
			padding-right: 1rem;
		}

		akkeris-addons > ul > li > .addon-info {
			margin-top:auto;
			margin-bottom:auto;
		}

		akkeris-addons > ul > li > .addon-info label {
			line-height:0;
		}

		akkeris-addons > ul > li > .addon-info pre {
			display: inline-block;
			color: #999;
			margin: 0;
    		padding: 0;
		}

		akkeris-addons > ul > li > .addon-info sub {
			display:block;
			line-height: 0.5rem;
			color: #aaa;
		}

		akkeris-addons > ul > li  > .addon-info pre:not(:last-of-type) code::after {
			display: inline-block;
			content: ","
		}

		akkeris-addons > ul > li > .addon-actions {
		}
		`;
  }
}


customElements.define('akkeris-addons', AkkerisAddons);
