var lunr = require('lunr');
var Entities = require('html-entities').AllHtmlEntities;

var Html = new Entities();

// Called with the `this` context provided by Gitbook
function buildIndex(context, docs) {
  // Create search index
  var ignoreSpecialCharacters = context.config.get('pluginsConfig.lunr.ignoreSpecialCharacters') || context.config.get('lunr.ignoreSpecialCharacters');
  return lunr(function () {
    this.ref('url');

    this.field('title', { boost: 10 });
    this.field('keywords', { boost: 15 });
    this.field('body');

    if (!ignoreSpecialCharacters) {
      // Don't trim non words characters (to allow search such as "C++")
      this.pipeline.remove(lunr.trimmer);
    }

    // disable the stemmer, since it produces odd results for
    // "deployments"
    this.pipeline.remove(lunr.stemmer);

    // disable the stop-word filter, since "and" and "or" are common
    // terms in programming examples.
    // FIXME: make this configurable
    this.pipeline.remove(lunr.stopWordFilter);

    // add all documents
    for (var key in docs) {
      if (docs.hasOwnProperty(key)) {
        this.add(docs[key]);
      }
    }
  });
}

// Map of Lunr ref to document
var documentsStore = {};

var searchIndexEnabled = true;
var indexSize = 0;

module.exports = {
  book: {
    assets: './assets',
    js: [ 'lunr.min.js', 'search-lunr.js' ]
  },

  hooks: {
    // Index each page
    'page': function(page) {
      if (this.output.name != 'website' || !searchIndexEnabled || page.search === false) {
          return page;
      }

      var text, maxIndexSize;
      maxIndexSize = this.config.get('pluginsConfig.lunr.maxIndexSize') || this.config.get('lunr.maxIndexSize');

      text = page.content;
      // Decode HTML
      text = Html.decode(text);
      // Strip HTML tags
      text = text.replace(/(<([^>]+)>)/ig, '');

      indexSize = indexSize + text.length;
      if (indexSize > maxIndexSize) {
        this.log.warn.ln('search index is too big, indexing is now disabled');
        searchIndexEnabled = false;
        return page;
      }

      var keywords = [];
      if (page.search) {
        keywords = page.search.keywords || [];
      }

      // Prepare indexable "doc".
      var doc = {
        url: this.output.toURL(page.path),
        title: page.title,
        summary: page.description,
        keywords: keywords.join(' '),
        body: text
      };

      documentsStore[doc.url] = doc;

      return page;
    },

    // Write index to disk
    'finish': function() {
      if (this.output.name != 'website') return;

      this.log.debug.ln('write search index');
      return this.output.writeFile('search_index.json', JSON.stringify({
        index: buildIndex(this, documentsStore),
        store: documentsStore
      }));
    }
  }
};

