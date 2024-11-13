console.log('wiki starter');

const searchUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=20&format=json&origin=*&srsearch=';
const imageUrl = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=150&origin=*&titles=';

const formDOM = document.querySelector('.form');
const inputDOM = document.querySelector('.form-input');
const resultsDOM = document.querySelector('.results');
const languageSelect = document.querySelector('.language-select');
const searchHistoryList = document.querySelector('.search-history');

// Tambahkan state untuk riwayat pencarian
let searchHistory = JSON.parse(localStorage.getItem('wikiSearchHistory')) || [];

// Fungsi untuk menyimpan riwayat pencarian
const saveSearchHistory = (searchTerm) => {
  if (!searchHistory.includes(searchTerm)) {
    searchHistory = [searchTerm, ...searchHistory].slice(0, 5);
    localStorage.setItem('wikiSearchHistory', JSON.stringify(searchHistory));
    displaySearchHistory();
  }
};

// Fungsi untuk menampilkan riwayat pencarian
const displaySearchHistory = () => {
  if (searchHistoryList) {
    const historyItems = searchHistory
      .map(
        (term) => `
        <li class="history-item">
          <button class="history-btn" data-term="${term}">${term}</button>
          <button class="delete-btn" data-term="${term}">×</button>  <!-- Tetap '×' tanpa perubahan -->
        </li>
      `
      )
      .join('');
    searchHistoryList.innerHTML = historyItems;
  }
};

// Fungsi untuk debounce pencarian
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Fungsi untuk copy link artikel
const copyArticleLink = (pageid) => {
  const link = `http://en.wikipedia.org/?curid=${pageid}`;
  navigator.clipboard.writeText(link).then(() => {
    showNotification('Link copied to clipboard!');
  });
};

// Fungsi untuk menampilkan notifikasi
const showNotification = (message) => {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
};

// Event listener untuk input (live search)
inputDOM.addEventListener(
  'input',
  debounce((e) => {
    const value = e.target.value;
    if (value.length >= 3) {
      fetchResults(value);
    }
  }, 500)
);

// Event listener untuk form submission
formDOM.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = inputDOM.value;
  if (!value) {
    resultsDOM.innerHTML = '<div class="error">please enter valid search term</div>';
    return;
  }

  showLoading();
  saveSearchHistory(value);
  await fetchResults(value);
});

// Event listener untuk riwayat pencarian
if (searchHistoryList) {
  searchHistoryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('history-btn')) {
      const term = e.target.dataset.term;
      inputDOM.value = term;
      fetchResults(term);
    }
    if (e.target.classList.contains('delete-btn')) {
      const term = e.target.dataset.term;
      searchHistory = searchHistory.filter(item => item !== term);
      localStorage.setItem('wikiSearchHistory', JSON.stringify(searchHistory));
      displaySearchHistory();
    }
  });
}

// Render function yang diperbarui
const renderResults = (list) => {
  const cardsList = list
    .map((item) => {
      const { title, snippet, pageid, thumbnail } = item;
      const cleanSnippet = snippet.replace(/(<([^>]+)>)/gi, '');
      
      return `
        <div class="article-card">
          <div class="article-content">
            ${thumbnail ? 
              `<div class="article-image">
                <img src="${thumbnail}" alt="${title}" loading="lazy">
               </div>` : 
              ''
            }
            <div class="article-info">
              <h4>${title}</h4>
              <p>${cleanSnippet}</p>
              <div class="article-actions">
                <a href="http://en.wikipedia.org/?curid=${pageid}" target="_blank" class="read-btn">Read Article</a>
                <button class="copy-btn" onclick="copyArticleLink('${pageid}')">Copy Link</button>
                <button class="share-btn" onclick="shareArticle('${pageid}', '${title}')">Share</button>
                <button class="reading-mode-btn" onclick="toggleReadingMode(this.closest('.article-card'))">📖</button>
              </div>
            </div>
          </div>
        </div>`;
    })
    .join('');
    
  resultsDOM.innerHTML = `
    <div class="results-info">Found ${list.length} results</div>
    <div class="articles">${cardsList}</div>
  `;
};

// Fungsi untuk sharing artikel
const shareArticle = async (pageid, title) => {
  const shareData = {
    title: `Wikipedia: ${title}`,
    text: `Check out this Wikipedia article about ${title}`,
    url: `http://en.wikipedia.org/?curid=${pageid}`
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      showNotification('Article shared successfully!');
    } else {
      copyArticleLink(pageid);
    }
  } catch (err) {
    console.error('Error sharing:', err);
  }
};

const showLoading = () => {
  resultsDOM.innerHTML = '<div class="loading"></div>';
};

const fetchResults = async (searchTerm) => {
  try {
    const searchValue = encodeURIComponent(searchTerm);
    const response = await fetch(`${searchUrl}${searchValue}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    const results = data.query.search;

    if (results.length < 1) {
      resultsDOM.innerHTML = '<div class="error">no matching results. Please try again</div>';
      return;
    }

    const resultsWithImages = await Promise.all(
      results.map(async (result) => {
        const imageData = await fetchImage(result.title);
        return { ...result, thumbnail: imageData };
      })
    );

    renderResults(resultsWithImages);
  } catch (error) {
    console.error('Error:', error);
    resultsDOM.innerHTML = '<div class="error">there was an error...</div>';
  }
};

const fetchImage = async (title) => {
  try {
    const response = await fetch(`${imageUrl}${encodeURIComponent(title)}`);
    const data = await response.json();
    const pages = data.query.pages;
    const firstPage = pages[Object.keys(pages)[0]];
    return firstPage.thumbnail?.source || null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

// Theme Toggling Functionality
const themeToggle = document.querySelector('.theme-toggle');
const toggleIcon = document.querySelector('.toggle-icon');

// Check for saved theme preference
const getCurrentTheme = () => {
  return localStorage.getItem('theme') || 'light';
};

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);
});

// Handle theme toggle click
themeToggle.addEventListener('click', () => {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
});

const toggleReadingMode = (articleCard) => {
  articleCard.classList.toggle('reading-mode');
  if (articleCard.classList.contains('reading-mode')) {
    articleCard.style.maxWidth = '800px';
    articleCard.style.margin = '0 auto';
    articleCard.style.fontSize = '1.2rem';
    articleCard.style.lineHeight = '1.8';
    articleCard.style.padding = '2rem';
  } else {
    articleCard.style = '';
  }
};

const randomArticleUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnlimit=1&format=json&origin=*';

const fetchRandomArticle = async () => {
  try {
    showLoading();
    const response = await fetch(randomArticleUrl);
    const data = await response.json();
    const randomArticle = data.query.random[0];
    const results = [{
      title: randomArticle.title,
      pageid: randomArticle.id,
      snippet: 'Loading random article...'
    }];
    
    const resultsWithImages = await Promise.all(
      results.map(async (result) => {
        const imageData = await fetchImage(result.title);
        return { ...result, thumbnail: imageData };
      })
    );

    renderResults(resultsWithImages);
  } catch (error) {
    console.error('Error:', error);
    resultsDOM.innerHTML = '<div class="error">Failed to fetch random article</div>';
  }
};
