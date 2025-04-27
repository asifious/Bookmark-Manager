// Initialize preferences
function initializePreferences() {
  chrome.storage.sync.get(['darkMode', 'sortOrder'], (data) => {
    if (data.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('darkModeToggle').textContent = '☀️';
    }
    const sortSelect = document.getElementById('sortOptions');
    if (data.sortOrder) {
      sortSelect.value = data.sortOrder;
    }
    loadBookmarks();
  });
}

// Toggle dark mode
document.getElementById('darkModeToggle').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
  chrome.storage.sync.set({ darkMode: isDark });
});

// Fetch and display bookmarks
function loadBookmarks(query = '') {
  chrome.bookmarks.getTree((bookmarkTree) => {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '';
    let bookmarks = flattenBookmarks(bookmarkTree[0].children);
    if (query) {
      bookmarks = bookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(query) ||
          bookmark.url.toLowerCase().includes(query)
      );
    }
    bookmarks = sortBookmarks(bookmarks, document.getElementById('sortOptions').value);
    displayBookmarks(bookmarks);
    updateFolderOptions(bookmarkTree[0].children);
  });
}

// Flatten bookmark tree to get all bookmarks
function flattenBookmarks(nodes) {
  let bookmarks = [];
  nodes.forEach((node) => {
    if (node.url) {
      bookmarks.push(node);
    }
    if (node.children) {
      bookmarks = bookmarks.concat(flattenBookmarks(node.children));
    }
  });
  return bookmarks;
}

// Sort bookmarks
function sortBookmarks(bookmarks, sortOption) {
  return bookmarks.sort((a, b) => {
    if (sortOption === 'title-asc') return a.title.localeCompare(b.title);
    if (sortOption === 'title-desc') return b.title.localeCompare(a.title);
    if (sortOption === 'url-asc') return a.url.localeCompare(b.url);
    if (sortOption === 'url-desc') return b.url.localeCompare(a.url);
    if (sortOption === 'date-asc') return a.dateAdded - b.dateAdded;
    if (sortOption === 'date-desc') return b.dateAdded - a.dateAdded;
    return 0;
  });
}

// // Display bookmarks in the result div
// function displayBookmarks(bookmarks) {
//   const resultDiv = document.getElementById('result');
//   bookmarks.forEach((bookmark) => {
//     const div = document.createElement('div');
//     div.className = 'bookmark-item';
//     div.draggable = true;
//     div.dataset.id = bookmark.id;
//     div.dataset.parentId = bookmark.parentId;
//     div.innerHTML = `
//       <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}">
//       <div class="bookmark-info">
//         <a href="${bookmark.url}" title="${bookmark.title}">${bookmark.title || bookmark.url}</a>
//         <div class="url">${bookmark.url}</div>
//       </div>
//       <button class="delete-btn" data-id="${bookmark.id}">Delete</button>
//     `;
//     resultDiv.appendChild(div);
//   });
//   updateButtonStates();
//   setupDragAndDrop();
// }

function getBookmarkPath(bookmarkId, callback) {
  chrome.bookmarks.get(bookmarkId, (nodes) => {
    const path = [];
    let current = nodes[0];

    function traverse(node) {
      path.unshift(node.title || '');
      if (node.parentId) {
        chrome.bookmarks.get(node.parentId, (parents) => {
          if (parents.length && parents[0].id !== '0') {
            traverse(parents[0]);
          } else {
            callback(path.join(' > '));
          }
        });
      } else {
        callback(path.join(' > '));
      }
    }

    traverse(current);
  });
}

function getVisitCount(url, callback) {
  if (!url) return callback(0);
  chrome.history.getVisits({ url }, (visits) => {
    callback(visits?.length || 0);
  });
}

function displayBookmarks(bookmarks) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '';

  bookmarks.forEach((bookmark) => {
    // Only process actual bookmark links (not folders)
    if (!bookmark.url) return;

    getBookmarkPath(bookmark.id, (locationPath) => {
      getVisitCount(bookmark.url, (visitCount) => {
        const div = document.createElement('div');
        div.className = 'bookmark-item';
        div.draggable = true;
        div.dataset.id = bookmark.id;
        div.dataset.parentId = bookmark.parentId;

        div.innerHTML = `
          <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}">
          <div class="bookmark-info">
            <a href="${bookmark.url}" title="${bookmark.title}" target="_blank">
              ${bookmark.title || bookmark.url}
            </a>
            <div class="url">${bookmark.url}</div>
            <div class="location-path"><strong>Location:</strong> ${locationPath}</div>
          </div>
          <span class="item-visit-count" style="text-align: end; display: block; padding: 5px; font-size: 12px; color: #666;">
              ${visitCount} visit${visitCount !== 1 ? 's' : ''}
          </span>
          <button class="delete-btn" data-id="${bookmark.id}">Delete</button>
        `;

        resultDiv.appendChild(div);
      });
    });
  });

  updateButtonStates();
  setupDragAndDrop();
}



// Populate folder options for move-to dropdown
function updateFolderOptions(nodes) {
  const folderSelect = document.getElementById('folderSelect');
  folderSelect.innerHTML = '<option value="">Move to...</option>';
  addFolderOptions(nodes, folderSelect, '');
}

function addFolderOptions(nodes, select, indent) {
  nodes.forEach((node) => {
    if (!node.url && node.children) {
      const option = document.createElement('option');
      option.value = node.id;
      option.text = indent + node.title || 'Untitled Folder';
      select.appendChild(option);
      addFolderOptions(node.children, select, indent + '  ');
    }
  });
}

// Create new folder
document.getElementById('createFolderBtn').addEventListener('click', () => {
  const folderName = document.getElementById('newFolderInput').value.trim();
  if (!folderName) return;
  chrome.bookmarks.create(
    {
      title: folderName,
      parentId: '1', // Bookmarks Menu
    },
    () => {
      document.getElementById('newFolderInput').value = '';
      chrome.bookmarks.getTree((bookmarkTree) => {
        updateFolderOptions(bookmarkTree[0].children);
      });
    }
  );
});

// Search bookmarks on button click
document.getElementById('searchBtn').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.toLowerCase();
  loadBookmarks(query);
});

// Sort bookmarks and save preference
document.getElementById('sortOptions').addEventListener('change', (e) => {
  const sortOption = e.target.value;
  chrome.storage.sync.set({ sortOrder: sortOption });
  loadBookmarks(document.getElementById('searchInput').value.toLowerCase());
});

// Select all bookmarks
document.getElementById('selectAllBtn').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.bookmark-checkbox');
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  checkboxes.forEach((cb) => (cb.checked = !allChecked));
  updateButtonStates();
});

// Update button states based on selection
function updateButtonStates() {
  const checkboxes = document.querySelectorAll('.bookmark-checkbox:checked');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const moveBtn = document.getElementById('moveSelectedBtn');
  deleteBtn.disabled = checkboxes.length === 0;
  moveBtn.disabled = checkboxes.length === 0;
}

// Delete individual bookmark
document.getElementById('result').addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    chrome.bookmarks.remove(id, () => {
      e.target.closest('.bookmark-item').remove();
      updateButtonStates();
    });
  }
});

// Delete selected bookmarks
document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.bookmark-checkbox:checked');
  checkboxes.forEach((cb) => {
    const id = cb.dataset.id;
    chrome.bookmarks.remove(id, () => {
      cb.closest('.bookmark-item').remove();
    });
  });
  updateButtonStates();
});

// Move selected bookmarks
document.getElementById('moveSelectedBtn').addEventListener('click', () => {
  const folderId = document.getElementById('folderSelect').value;
  if (!folderId) return;
  const checkboxes = document.querySelectorAll('.bookmark-checkbox:checked');
  checkboxes.forEach((cb) => {
    const id = cb.dataset.id;
    chrome.bookmarks.move(id, { parentId: folderId }, () => {
      cb.closest('.bookmark-item').remove();
    });
  });
  updateButtonStates();
});

// Drag-and-drop setup
function setupDragAndDrop() {
  const bookmarkItems = document.querySelectorAll('.bookmark-item');
  bookmarkItems.forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (dragging && item !== dragging && item.dataset.parentId === dragging.dataset.parentId) {
        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isBefore = e.clientY < midpoint;
        item.parentNode.insertBefore(dragging, isBefore ? item : item.nextSibling);
      }
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetItem = item;
      if (draggedId === targetItem.dataset.id) return;
      const parentId = targetItem.dataset.parentId;
      const siblings = Array.from(document.querySelectorAll(`.bookmark-item[data-parent-id="${parentId}"]`));
      const newIndex = siblings.indexOf(targetItem);
      chrome.bookmarks.move(draggedId, { parentId, index: newIndex }, () => {
        loadBookmarks(document.getElementById('searchInput').value.toLowerCase());
      });
    });
  });
}

// Update button states on checkbox change
document.getElementById('result').addEventListener('change', updateButtonStates);

// Initial load
initializePreferences();