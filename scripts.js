document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar-container');
    var miniCalendarEl = document.getElementById('mini-calendar');
    var modal = document.getElementById('event-modal');
    var settingsModal = document.getElementById('settings-modal');
    var eventForm = document.getElementById('event-form');
    var categoryForm = document.getElementById('category-form');
    var searchInput = document.getElementById('search-input');
    var statusMessage = document.getElementById('status-message');
    var conflictWarning = document.getElementById('conflict-warning');
    var allDayInput = document.getElementById('modal-all-day');
    var repeatInput = document.getElementById('modal-repeat');
    var occurrencesField = document.getElementById('field-occurrences');
    var occurrencesInput = document.getElementById('modal-occurrences');
    var fromField = document.getElementById('field-from');
    var toField = document.getElementById('field-to');
    var fromInput = document.getElementById('modal-from');
    var toInput = document.getElementById('modal-to');
    var tooltip = document.getElementById('event-tooltip');
    var sidebar = document.getElementById('sidebar');
    var categoryFilters = Array.prototype.slice.call(document.querySelectorAll('.category-filter'));
    var legendChips = Array.prototype.slice.call(document.querySelectorAll('.legend-chip'));
    var categories = [];
    var isSaving = false;
    var isFiltering = false;

    function on(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    var currentFiles = [];
    var filters = {
        text: '',
        categories: new Set(categoryFilters.map(function (input) { return input.value; })),
        start: '',
        end: ''
    };

    var miniCalendar = new FullCalendar.Calendar(miniCalendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
        },
        locale: 'pt-br',
        height: 'auto',
        fixedWeekCount: false,
        dateClick: function (info) {
            calendar.gotoDate(info.date);
            calendar.changeView(window.innerWidth < 900 ? 'timeGridDay' : 'timeGridWeek');
            closeSidebarOnMobile();
        }
    });

    miniCalendar.render();

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: false,
        themeSystem: 'standard',
        locale: 'pt-br',
        editable: true,
        selectable: true,
        dayMaxEvents: 3,
        nowIndicator: true,
        firstDay: 1,
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
        },
        events: function (info, successCallback, failureCallback) {
            var url = 'index.php?action=list&_dc=' + new Date().getTime();
            fetch(url)
                .then(function (response) { return response.json(); })
                .then(function (data) { successCallback(data); })
                .catch(function (err) { failureCallback(err); });
        },

        datesSet: function (info) {
            var currentDateEl = document.getElementById('current-date');
            if (currentDateEl) currentDateEl.innerText = info.view.title;
            
            var viewSelector = document.getElementById('view-selector');
            if (viewSelector) viewSelector.value = info.view.type;

            if (miniCalendar) {
                miniCalendar.gotoDate(info.view.currentStart);
            }
            applyFilters();
        },

        eventsSet: function () {
            applyFilters();
        },

        select: function (info) {
            var start = info.start;
            var end = info.end;
            
            var fromTime = '09:00';
            var toTime = '10:00';
            
            if (!info.all_day && start.getHours() !== 0) {
                fromTime = formatLocalTime(start);
                if (formatLocalDate(start) === formatLocalDate(end)) {
                    toTime = formatLocalTime(end);
                } else {
                    var nextHour = new Date(start);
                    nextHour.setHours(nextHour.getHours() + 1);
                    toTime = formatLocalTime(nextHour);
                }
            }

            openModal({
                date: formatLocalDate(start),
                from: fromTime,
                to: toTime,
                all_day: info.allDay,
                repeat: 'none'
            });
        },

        dateClick: function (info) {
            if (calendar.view.type === 'dayGridMonth') {
                openModal({
                    date: formatLocalDate(info.date),
                    from: '09:00',
                    to: '10:00',
                    all_day: true,
                    repeat: 'none'
                });
            }
        },

        eventClick: function (info) {
            var props = Object.assign({}, info.event.extendedProps, {
                title: info.event.title,
                date: formatLocalDate(info.event.start),
                from: info.event.allDay ? '09:00' : formatLocalTime(info.event.start),
                to: info.event.allDay ? '10:00' : formatLocalTime(info.event.end || info.event.start),
                all_day: info.event.allDay
            });
            openModal(props, info.event.id);
        },

        eventDrop: function (info) {
            updateEvent(info.event);
        },

        eventResize: function (info) {
            updateEvent(info.event);
        },

        eventDidMount: function (info) {
            var category = info.event.extendedProps.category || 'pessoal';
            info.el.dataset.category = category;
            info.el.addEventListener('mouseenter', function (event) {
                showTooltip(info.event, event);
            });
            info.el.addEventListener('mousemove', function (event) {
                moveTooltip(event);
            });
            info.el.addEventListener('mouseleave', hideTooltip);
        }
    });

    calendar.render();

    function formatLocalDate(date) {
        var d = new Date(date);
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function formatLocalTime(date) {
        var d = new Date(date);
        var hours = String(d.getHours()).padStart(2, '0');
        var minutes = String(d.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    }

    function sameOrAfter(dateA, dateB) {
        return !dateB || dateA >= dateB;
    }

    function sameOrBefore(dateA, dateB) {
        return !dateB || dateA <= dateB;
    }

    function setStatus(message, tone) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        if (tone) {
            statusMessage.classList.add('is-' + tone);
        }
        if (message) {
            window.clearTimeout(setStatus.timeoutId);
            setStatus.timeoutId = window.setTimeout(function () {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 2800);
        }
    }

    function syncLegendControls() {
        legendChips.forEach(function (chip) {
            var active = filters.categories.has(chip.dataset.category);
            chip.classList.toggle('active', active);
        });

        categoryFilters.forEach(function (input) {
            input.checked = filters.categories.has(input.value);
        });
    }

    function applyFilters() {
        if (!calendar || isFiltering) return;
        isFiltering = true;
        
        calendar.getEvents().forEach(function (event) {
            var title = (event.title || '').toLowerCase();
            var note = ((event.extendedProps.note || '') + '').toLowerCase();
            var category = event.extendedProps.category || 'pessoal';
            var eventDate = formatLocalDate(event.start);
            var matchesText = !filters.text || title.includes(filters.text) || note.includes(filters.text);
            var matchesCategory = filters.categories.has(category);
            var matchesStart = sameOrAfter(eventDate, filters.start);
            var matchesEnd = sameOrBefore(eventDate, filters.end);

            var shouldDisplay = matchesText && matchesCategory && matchesStart && matchesEnd ? 'auto' : 'none';
            
            if (event.display !== shouldDisplay) {
                event.setProp('display', shouldDisplay);
            }
        });

        isFiltering = false;
    }

    function setAllCategories(enabled) {
        filters.categories = new Set(enabled ? categoryFilters.map(function (input) { return input.value; }) : []);
        syncLegendControls();
        applyFilters();
    }

    function closeSidebarOnMobile() {
        if (sidebar && window.innerWidth < 1080) {
            sidebar.classList.remove('is-open');
        }
    }

    syncLegendControls();

    function toggleCategory(category) {
        if (filters.categories.has(category)) {
            filters.categories.delete(category);
        } else {
            filters.categories.add(category);
        }
        syncLegendControls();
        applyFilters();
    }

    function hideTooltip() {
        tooltip.hidden = true;
    }

    function moveTooltip(event) {
        tooltip.style.left = event.pageX + 18 + 'px';
        tooltip.style.top = event.pageY + 18 + 'px';
    }

    function showTooltip(fcEvent, event) {
        var category = fcEvent.extendedProps.category || 'pessoal';
        var note = fcEvent.extendedProps.note ? '<p>' + escapeHtml(fcEvent.extendedProps.note) + '</p>' : '';
        var timeLabel = fcEvent.allDay
            ? 'Dia inteiro'
            : escapeHtml(formatLocalTime(fcEvent.start) + ' - ' + formatLocalTime(fcEvent.end || fcEvent.start));

        tooltip.innerHTML =
            '<strong>' + escapeHtml(fcEvent.title || 'Sem título') + '</strong>' +
            '<span>' + escapeHtml(capitalize(category)) + ' • ' + timeLabel + '</span>' +
            note;
        tooltip.hidden = false;
        moveTooltip(event);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function refreshAllCalendars() {
        if (calendar) {
            calendar.refetchEvents();
            setTimeout(function() {
                calendar.refetchEvents();
                if (miniCalendar) miniCalendar.refetchEvents();
            }, 100);
        }
    }

    function closeModal() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        conflictWarning.hidden = true;
        currentFiles = [];
        var fileList = document.getElementById('file-list');
        if (fileList) {
            fileList.innerHTML = '';
        }
    }

    function closeSettingsModal() {
        settingsModal.classList.remove('is-open');
        settingsModal.setAttribute('aria-hidden', 'true');
        resetCategoryForm();
    }

    function openSettingsModal() {
        loadCategories();
        settingsModal.classList.add('is-open');
        settingsModal.setAttribute('aria-hidden', 'false');
    }

    function toggleAllDayState() {
        var allDay = allDayInput.checked;
        fromField.classList.toggle('is-hidden', allDay);
        toField.classList.toggle('is-hidden', allDay);
        fromInput.disabled = allDay;
        toInput.disabled = allDay;
    }

    function toggleOccurrencesState() {
        var isRecurring = repeatInput.value !== 'none';
        occurrencesField.classList.toggle('is-hidden', !isRecurring);
        occurrencesInput.disabled = !isRecurring;
        if (!isRecurring) {
            occurrencesInput.value = 1;
        }
    }

    function checkConflicts(ignoreEventId) {
        conflictWarning.hidden = true;

        var date = document.getElementById('modal-date').value;
        var allDay = allDayInput.checked;
        if (!date) {
            return;
        }

        var from = fromInput.value;
        var to = toInput.value;
        var conflict = calendar.getEvents().find(function (event) {
            if (event.id === ignoreEventId) {
                return false;
            }
            if (formatLocalDate(event.start) !== date) {
                return false;
            }
            if (allDay || event.allDay) {
                return true;
            }

            var eventStart = formatLocalTime(event.start);
            var eventEnd = formatLocalTime(event.end || event.start);
            return from < eventEnd && to > eventStart;
        });

        if (conflict) {
            conflictWarning.textContent = 'Conflito encontrado com "' + (conflict.title || 'Sem título') + '". Você ainda pode salvar se quiser.';
            conflictWarning.hidden = false;
        }
    }

    function getFileIcon(fileName) {
        var ext = fileName.split('.').pop().toLowerCase();
        var icons = {
            pdf: '📄',
            doc: '📝', docx: '📝',
            xls: '📊', xlsx: '📊',
            ppt: '📽️', pptx: '📽️',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
            mp3: '🎵', wav: '🎵',
            mp4: '🎬', avi: '🎬', mov: '🎬',
            zip: '📦', rar: '📦', tar: '📦', gz: '📦',
            txt: '📃',
            psd: '🎨', ai: '🎨',
            default: '📎'
        };
        return icons[ext] || icons.default;
    }

    function renderFileList() {
        var fileList = document.getElementById('file-list');
        fileList.innerHTML = '';
        
        currentFiles.forEach(function (file, index) {
            var fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            var fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            var fileIcon = document.createElement('span');
            fileIcon.className = 'file-icon';
            fileIcon.textContent = getFileIcon(file.name);
            
            var fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            fileInfo.appendChild(fileIcon);
            fileInfo.appendChild(fileName);
            
            if (file.isExisting) {
                var fileLink = document.createElement('a');
                fileLink.href = 'uploads/' + encodeURIComponent(file.name);
                fileLink.target = '_blank';
                fileLink.className = 'file-link';
                fileLink.textContent = 'Abrir';
                fileInfo.appendChild(fileLink);
            }
            
            var removeBtn = document.createElement('button');
            removeBtn.className = 'file-remove';
            removeBtn.textContent = '×';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', function () {
                currentFiles.splice(index, 1);
                renderFileList();
                updateKeepFiles();
            });
            
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(removeBtn);
            fileList.appendChild(fileItem);
        });
    }

    function updateKeepFiles() {
        var keepFiles = currentFiles.filter(function (file) { return file.isExisting; }).map(function (file) { return file.name; });
        document.getElementById('modal-keep-files').value = JSON.stringify(keepFiles);
    }

    function populateModal(data, id) {
        document.getElementById('modal-id').value = id || '';
        document.getElementById('modal-series-id').value = data.series_id || '';
        document.getElementById('modal-title').value = data.title || '';
        document.getElementById('modal-date').value = data.date || formatLocalDate(new Date());
        document.getElementById('modal-from').value = data.from || '09:00';
        document.getElementById('modal-to').value = data.to || '10:00';
        document.getElementById('modal-note').value = data.note || '';
        document.getElementById('modal-category').value = data.category || 'pessoal';
        document.getElementById('modal-repeat').value = data.repeat || 'none';
        document.getElementById('modal-occurrences').value = 1;
        document.getElementById('modal-eyebrow').innerText = id ? 'Editar compromisso' : 'Novo compromisso';
        allDayInput.checked = Boolean(data.all_day);
        toggleAllDayState();
        toggleOccurrencesState();
        if (id) {
            occurrencesInput.value = 1;
        }
        document.getElementById('btn-delete').style.display = id ? 'inline-flex' : 'none';
        
        currentFiles = [];
        var files = data.files || [];
        if (Array.isArray(files)) {
            files.forEach(function (fileName) {
                currentFiles.push({ name: fileName, isExisting: true });
            });
        }
        
        renderFileList();
        updateKeepFiles();
    }

    function openModal(data, id) {
        populateModal(data, id);
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('modal-title').focus();
        checkConflicts(id || '');
    }

    function serializeForm() {
        var formData = new FormData(eventForm);
        formData.set('all_day', allDayInput.checked ? '1' : '0');
        formData.delete('files[]');
        currentFiles.forEach(function (file) {
            if (!file.isExisting && file.file) {
                formData.append('files[]', file.file, file.name);
            }
        });
        if (allDayInput.checked) {
            formData.set('from', '00:00');
            formData.set('to', '23:59');
        }
        return formData;
    }

    function duplicateCurrentEvent() {
        var id = document.getElementById('modal-id').value;
        if (!id) {
            setStatus('Preencha os dados e salve para duplicar depois.', 'warn');
            return;
        }
        var original = calendar.getEventById(id);
        if (!original) {
            return;
        }
        var nextDate = new Date(original.start);
        nextDate.setDate(nextDate.getDate() + 1);
        openModal({
            title: original.title + ' (cópia)',
            date: formatLocalDate(nextDate),
            from: original.allDay ? '09:00' : formatLocalTime(original.start),
            to: original.allDay ? '10:00' : formatLocalTime(original.end || original.start),
            note: original.extendedProps.note || '',
            category: original.extendedProps.category || 'pessoal',
            all_day: original.allDay,
            repeat: 'none',
            series_id: ''
        });
    }

    function updateEvent(event) {
        var formData = new FormData();
        formData.append('id', event.id);
        formData.append('date', formatLocalDate(event.start));
        formData.append('from', event.allDay ? '00:00' : formatLocalTime(event.start));
        formData.append('to', event.allDay ? '23:59' : formatLocalTime(event.end || event.start));
        formData.append('title', event.title || '');
        formData.append('category', event.extendedProps.category || 'pessoal');
        formData.append('note', event.extendedProps.note || '');
        formData.append('repeat', event.extendedProps.repeat || 'none');
        formData.append('series_id', event.extendedProps.series_id || '');
        formData.append('all_day', event.allDay ? '1' : '0');
        formData.append('keep_files', JSON.stringify(event.extendedProps.files || []));

        fetch('index.php?action=update', {
            method: 'POST',
            body: formData
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) {
                    setStatus('Não consegui atualizar. Recarregando os eventos.', 'error');
                    refreshAllCalendars();
                    return;
                }
                setStatus('Evento atualizado.', 'success');
                refreshAllCalendars();
            })
            .catch(function () {
                setStatus('Falha ao atualizar o evento.', 'error');
                refreshAllCalendars();
            });
    }

    function loadCategories() {
        fetch('index.php?action=list_categories')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                var oldCategories = categories;
                categories = data;
                
                var newCategories = categories.filter(function (cat) {
                    return !oldCategories.some(function (oldCat) { return oldCat.id === cat.id; });
                });
                
                newCategories.forEach(function (cat) {
                    filters.categories.add(cat.name);
                });
                
                renderCategoriesList();
                updateCategorySelect();
                updateFiltersAndLegend();
                applyFilters();
            });
    }

    function renderCategoriesList() {
        var list = document.getElementById('categories-list');
        list.innerHTML = categories.map(function (cat) {
            return '<div class="category-item" data-id="' + cat.id + '">' +
                '<span class="category-color" style="background-color: ' + escapeHtml(cat.color) + '"></span>' +
                '<span class="category-label">' + escapeHtml(cat.label) + '</span>' +
                '<span class="category-name">(' + escapeHtml(cat.name) + ')</span>' +
                '<div class="category-actions">' +
                '<button type="button" class="text-button edit-category" data-id="' + cat.id + '">Editar</button>' +
                '<button type="button" class="text-button danger delete-category" data-id="' + cat.id + '">Excluir</button>' +
                '</div>' +
                '</div>';
        }).join('');

        list.querySelectorAll('.edit-category').forEach(function (btn) {
            btn.addEventListener('click', function () {
                editCategory(parseInt(btn.dataset.id));
            });
        });

        list.querySelectorAll('.delete-category').forEach(function (btn) {
            btn.addEventListener('click', function () {
                deleteCategory(parseInt(btn.dataset.id));
            });
        });
    }

    function updateCategorySelect() {
        var select = document.getElementById('modal-category');
        if (!select) return;
        select.innerHTML = categories.map(function (cat) {
            return '<option value="' + escapeHtml(cat.name) + '">' + escapeHtml(cat.label) + '</option>';
        }).join('');
    }

    function updateCategoryColors() {
        var style = document.getElementById('category-colors');
        if (!style) {
            style = document.createElement('style');
            style.id = 'category-colors';
            document.head.appendChild(style);
        }
        
        style.textContent = categories.map(function (cat) {
            return '.legend-dot.' + cat.name + ' { background: ' + cat.color + '; }' +
                   '.cat-' + cat.name + ' { background: linear-gradient(135deg, ' + cat.color + ' 0%, ' + adjustColor(cat.color, -20) + ' 100%) !important; }';
        }).join('');
    }

    function adjustColor(color, amount) {
        var num = parseInt(color.slice(1), 16);
        var r = Math.max(0, Math.min(255, (num >> 16) + amount));
        var g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        var b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    function updateFiltersAndLegend() {
        var sidebar = document.querySelector('.filter-stack');
        var legendRow = document.querySelector('.legend-row');
        
        updateCategoryColors();
        
        if (sidebar) {
            sidebar.innerHTML = categories.map(function (cat) {
                var isChecked = filters.categories.has(cat.name);
                return '<label class="filter-option">' +
                    '<input type="checkbox" value="' + escapeHtml(cat.name) + '" class="category-filter" ' + (isChecked ? 'checked' : '') + '>' +
                    '<span class="legend-dot ' + escapeHtml(cat.name) + '"></span>' +
                    '<span>' + escapeHtml(cat.label) + '</span>' +
                    '</label>';
            }).join('');
            
            categoryFilters = Array.prototype.slice.call(sidebar.querySelectorAll('.category-filter'));
            
            categoryFilters.forEach(function (input) {
                input.addEventListener('change', function () {
                    toggleCategory(input.value);
                });
            });
        }
        
        if (legendRow) {
            legendRow.innerHTML = categories.map(function (cat) {
                var isActive = filters.categories.has(cat.name);
                return '<button type="button" class="legend-chip ' + (isActive ? 'active' : '') + '" data-category="' + escapeHtml(cat.name) + '">' +
                    '<span class="legend-dot ' + escapeHtml(cat.name) + '"></span>' + escapeHtml(cat.label) +
                    '</button>';
            }).join('');
            
            legendChips = Array.prototype.slice.call(legendRow.querySelectorAll('.legend-chip'));
            
            legendChips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    toggleCategory(chip.dataset.category);
                });
            });
        }
    }

    function resetCategoryForm() {
        document.getElementById('category-form-title').textContent = 'Nova Categoria';
        document.getElementById('category-id').value = '';
        document.getElementById('category-name').value = '';
        document.getElementById('category-label').value = '';
        document.getElementById('category-color').value = '#6366f1';
        document.getElementById('category-order').value = categories.length;
    }

    function editCategory(id) {
        var cat = categories.find(function (c) { return c.id === id; });
        if (!cat) return;
        
        document.getElementById('category-form-title').textContent = 'Editar Categoria';
        document.getElementById('category-id').value = cat.id;
        document.getElementById('category-name').value = cat.name;
        document.getElementById('category-label').value = cat.label;
        document.getElementById('category-color').value = cat.color;
        document.getElementById('category-order').value = cat.order;
    }

    function deleteCategory(id) {
        if (!window.confirm('Deseja realmente excluir esta categoria?')) {
            return;
        }
        
        var formData = new FormData();
        formData.append('id', id);
        
        fetch('index.php?action=delete_category', {
            method: 'POST',
            body: formData
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.success) {
                    loadCategories();
                    setStatus('Categoria excluída.', 'success');
                } else {
                    setStatus('Falha ao excluir categoria.', 'error');
                }
            });
    }

    syncLegendControls();
    toggleAllDayState();
    toggleOccurrencesState();
    applyFilters();
    loadCategories();

    on('btn-today', 'click', function () { calendar.today(); });
    on('btn-prev', 'click', function () { calendar.prev(); });
    on('btn-next', 'click', function () { calendar.next(); });
    on('view-selector', 'change', function () {
        if (this.value) {
            calendar.changeView(this.value);
        }
    });
    
    on('btn-create', 'click', function () {
        openModal({
            date: formatLocalDate(new Date()),
            from: '09:00',
            to: '10:00',
            all_day: false,
            repeat: 'none'
        });
        closeSidebarOnMobile();
    });

    on('btn-clear-filters', 'click', function () {
        searchInput.value = '';
        document.getElementById('filter-start').value = '';
        document.getElementById('filter-end').value = '';
        filters.text = '';
        filters.start = '';
        filters.end = '';
        setAllCategories(true);
        setStatus('Filtros limpos.', 'success');
    });

    on('btn-cancel', 'click', closeModal);
    on('btn-close-modal', 'click', closeModal);
    on('btn-duplicate', 'click', duplicateCurrentEvent);
    on('btn-settings', 'click', openSettingsModal);
    on('btn-close-settings', 'click', closeSettingsModal);
    on('btn-cancel-category', 'click', resetCategoryForm);

    var modalFile = document.getElementById('modal-file');
    if (modalFile) {
        modalFile.addEventListener('change', function () {
            if (this.files && this.files.length > 0) {
                Array.prototype.forEach.call(this.files, function (file) {
                    currentFiles.push({ name: file.name, isExisting: false, file: file });
                });
                renderFileList();
            }
            this.value = '';
        });

        var uploadContainer = modalFile.closest('.file-upload-container');
        if (uploadContainer) {
            uploadContainer.addEventListener('dragover', function (e) {
                e.preventDefault();
                uploadContainer.querySelector('.file-upload-label').style.borderColor = 'var(--brand)';
                uploadContainer.querySelector('.file-upload-label').style.background = 'var(--brand-soft)';
            });

            uploadContainer.addEventListener('dragleave', function (e) {
                e.preventDefault();
                uploadContainer.querySelector('.file-upload-label').style.borderColor = 'var(--line-strong)';
                uploadContainer.querySelector('.file-upload-label').style.background = 'rgba(255, 255, 255, 0.6)';
            });

            uploadContainer.addEventListener('drop', function (e) {
                e.preventDefault();
                uploadContainer.querySelector('.file-upload-label').style.borderColor = 'var(--line-strong)';
                uploadContainer.querySelector('.file-upload-label').style.background = 'rgba(255, 255, 255, 0.6)';
                
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    Array.prototype.forEach.call(e.dataTransfer.files, function (file) {
                        currentFiles.push({ name: file.name, isExisting: false, file: file });
                    });
                    renderFileList();
                }
            });
        }
    }

    on('btn-delete', 'click', function () {
        var id = document.getElementById('modal-id').value;
        if (!id) {
            closeModal();
            return;
        }

        if (!window.confirm('Deseja realmente excluir este evento?')) {
            return;
        }

        fetch('index.php?action=delete&id=' + encodeURIComponent(id), {
            method: 'POST'
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.success) {
                    refreshAllCalendars();
                    closeModal();
                    setStatus('Evento excluído.', 'success');
                }
            })
            .catch(function () {
                setStatus('Falha ao excluir o evento.', 'error');
            });
    });

    if (eventForm) {
        eventForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (isSaving) {
                return;
            }

            var fromVal = fromInput.value;
            var toVal = toInput.value;

            if (!allDayInput.checked && fromVal >= toVal) {
                conflictWarning.textContent = 'O horário final precisa ser maior do que o inicial.';
                conflictWarning.hidden = false;
                return;
            }

            isSaving = true;
            setStatus('Salvando evento...', 'info');
            var formData = serializeForm();
            var id = formData.get('id');
            var action = id ? 'update' : 'create';

            fetch('index.php?action=' + action, {
                method: 'POST',
                body: formData
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        refreshAllCalendars();
                        closeModal();
                        setStatus(id ? 'Evento salvo.' : 'Evento criado.', 'success');
                    } else {
                        setStatus('Não foi possível salvar o evento: ' + (data.message || 'Erro desconhecido'), 'error');
                    }
                })
                .catch(function (err) {
                    console.error(err);
                    setStatus('Falha ao salvar o evento.', 'error');
                })
                .finally(function () {
                    isSaving = false;
                });
        });
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', function (e) {
            e.preventDefault();
            
            var formData = new FormData(categoryForm);
            fetch('index.php?action=save_category', {
                method: 'POST',
                body: formData
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        loadCategories();
                        resetCategoryForm();
                        setStatus('Categoria salva.', 'success');
                    } else {
                        setStatus('Falha ao salvar categoria.', 'error');
                    }
                });
        });
    }

    [document.getElementById('modal-date'), fromInput, toInput, allDayInput].forEach(function (el) {
        if (el) {
            el.addEventListener('change', function () {
                checkConflicts(document.getElementById('modal-id').value);
            });
        }
    });

    if (allDayInput) {
        allDayInput.addEventListener('change', function () {
            toggleAllDayState();
            checkConflicts(document.getElementById('modal-id').value);
        });
    }

    if (repeatInput) {
        repeatInput.addEventListener('change', toggleOccurrencesState);
    }

    if (searchInput) {
        var searchTimeout;
        searchInput.addEventListener('input', function (e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                filters.text = e.target.value.trim().toLowerCase();
                applyFilters();
            }, 250);
        });
    }

    on('filter-start', 'change', function (e) {
        filters.start = e.target.value;
        applyFilters();
    });

    on('filter-end', 'change', function (e) {
        filters.end = e.target.value;
        applyFilters();
    });

    on('sidebar-toggle', 'click', function () {
        sidebar.classList.toggle('is-open');
    });

    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', function (event) {
            if (event.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeModal();
            closeSettingsModal();
            closeSidebarOnMobile();
        }

        if (event.key === '/' && document.activeElement !== searchInput) {
            event.preventDefault();
            searchInput.focus();
        }

        if ((event.key === 'n' || event.key === 'N') && modal && !modal.classList.contains('is-open')) {
            var tag = document.activeElement.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
                event.preventDefault();
                var btnCreate = document.getElementById('btn-create');
                if (btnCreate) btnCreate.click();
            }
        }
    });

    window.addEventListener('resize', function () {
        if (window.innerWidth >= 1080) {
            if (sidebar) sidebar.classList.remove('is-open');
        }
    });
});
