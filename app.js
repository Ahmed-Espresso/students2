// app.js - نظام إدارة طلاب ذوي الإعاقة السمعية - الإصدار المعدل

// ============================================
// 1. تهيئة Firebase والمتغيرات العامة
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCYKp5mi2gDJGg4l5sOURJXGiQQOPDWU3s",
    authDomain: "students-59f43.firebaseapp.com",
    databaseURL: "https://students-59f43-default-rtdb.firebaseio.com",
    projectId: "students-59f43",
    storageBucket: "students-59f43.firebasestorage.app",
    messagingSenderId: "248717629262",
    appId: "1:248717629262:web:a7ee2ad69da4bc6f38f01f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let currentUser = null;
let currentUserData = null;
let searchTimeout = null;
let subjects = [];
let studentTeachers = [];

// ============================================
// 2. وظائف مساعدة عامة
// ============================================
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showToast(message, type = 'info') {
    // إزالة أي رسائل سابقة
    const existingToasts = document.querySelectorAll('.toast-message');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // إضافة الأنماط إذا لم تكن موجودة
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-message {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
                max-width: 400px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .toast-success { border-right: 4px solid #2ecc71; }
            .toast-error { border-right: 4px solid #e74c3c; }
            .toast-info { border-right: 4px solid #3498db; }
            .toast-message i { font-size: 18px; }
            .toast-success i { color: #2ecc71; }
            .toast-error i { color: #e74c3c; }
            .toast-info i { color: #3498db; }
            .toast-close {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                margin-right: auto;
            }
        `;
        document.head.appendChild(style);
    }
    
    // إزالة الرسالة بعد 5 ثواني
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('ar-EG', options);
    const dateElements = document.querySelectorAll('#currentDate');
    dateElements.forEach(element => {
        if (element) element.textContent = dateString;
    });
}

function formatDateDay(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', { day: 'numeric' });
}

function formatDateMonth(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', { month: 'short' });
}

// وظائف التحقق من الإدخال
function validatePhone(phone) {
    if (!phone) return true; // غير مطلوب
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
}

function validateBirthDate(date) {
    const inputDate = new Date(date);
    const today = new Date();
    return inputDate <= today;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ============================================
// 3. نظام تسجيل الدخول (index.html)
// ============================================
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function(e) {
            togglePasswordVisibility(e);
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

function togglePasswordVisibility(e) {
    const toggleBtn = e.currentTarget;
    const passwordInput = document.getElementById('password');
    const eyeIcon = toggleBtn.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showError('يرجى ملء جميع الحقول');
        return;
    }
    
    if (!validateEmail(email)) {
        showError('البريد الإلكتروني غير صالح');
        return;
    }
    
    showLoading();
    
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            return firebase.database().ref('users/' + user.uid).once('value');
        })
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const role = userData.role;
                
                switch(role) {
                    case 'admin':
                        window.location.href = 'admin.html';
                        break;
                    case 'specialist':
                        window.location.href = 'specialist.html';
                        break;
                    case 'teacher':
                        window.location.href = 'teacher.html';
                        break;
                    case 'parent':
                        window.location.href = 'parent.html';
                        break;
                    case 'student':
                        window.location.href = 'student.html';
                        break;
                    default:
                        showError('دور المستخدم غير معروف');
                        hideLoading();
                }
            } else {
                showError('بيانات المستخدم غير موجودة في قاعدة البيانات');
                hideLoading();
            }
        })
        .catch((error) => {
            console.error('خطأ في تسجيل الدخول:', error);
            let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'المستخدم غير موجود';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'كلمة المرور غير صحيحة';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'هذا الحساب معطل';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'تم محاولة تسجيل الدخول مرات عديدة، حاول لاحقاً';
                    break;
            }
            
            showError(errorMessage);
            hideLoading();
        });
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    const errorText = document.getElementById('errorText');
    
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// ============================================
// 4. وظائف لوحة التحكم العامة
// ============================================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
    
    if (mainContent) {
        mainContent.classList.toggle('expanded');
    }
    
    const toggleBtn = document.querySelector('.sidebar-toggle');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            if (sidebar.classList.contains('collapsed')) {
                icon.className = 'fas fa-bars';
            } else {
                icon.className = 'fas fa-times';
            }
        }
    }
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) {
        activeSection.classList.add('active');
        
        // تهيئة البحث عند فتح القسم
        if (sectionId === 'students' || sectionId === 'users' || sectionId === 'grades-list' || 
            sectionId === 'evaluations' || sectionId === 'medical-history' || sectionId === 'children' ||
            sectionId === 'subjects' || sectionId === 'assign-teachers' || sectionId === 'my-students') {  
            setTimeout(() => {
                initSearch(sectionId);
                adjustContentHeight();
            }, 300);
        }
    }
    
    const activeNavLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeNavLink) {
        activeNavLink.classList.add('active');
    }
    
    updatePageTitle(sectionId);
}

function updatePageTitle(sectionId) {
    const pageTitle = document.getElementById('pageTitle');
    if (!pageTitle) return;
    
    const titles = {
        'home': 'الصفحة الرئيسية',
        'students': 'قائمة الطلاب',
        'add-student': 'إضافة طالب جديد',
        'users': 'جميع المستخدمين',
        'add-user': 'إضافة مستخدم جديد',
        'child-profile': 'ملف ابني/ابنتي',
        'child-grades': 'النتائج الدراسية',
        'follow-up': 'المتابعة الطبية',
        'profile': 'الملف الشخصي',
        'grades': 'النتائج الدراسية',
        'my-students': 'طلابي',
        'add-grade': 'إضافة درجات',
        'grades-list': 'قائمة الدرجات',
        'children': 'جميع الأطفال',
        'add-evaluation': 'إضافة تقييم',
        'evaluations': 'التقييمات السابقة',
        'medical-history': 'التاريخ المرضي',
        'sessions': 'جدول الجلسات',
        'subjects': 'المواد الدراسية',
        'assign-teachers': 'تعيين معلمين',
        'my-teachers': 'معلمي'
    };
    
    pageTitle.textContent = titles[sectionId] || 'الصفحة الرئيسية';
}

// ============================================
// 5. نظام البحث في الجداول - محسّن
// ============================================
function initSearch(sectionId) {
    const tableIdMap = {
        'students': 'adminStudentsTable',
        'users': 'adminUsersTable',
        'grades-list': 'gradesListTable',
        'evaluations': 'evaluationsTable',
        'medical-history': 'medicalHistoryTable',
        'children': 'specialistChildrenTable',
        'my-students': 'teacherStudentsTable',
        'subjects': 'adminSubjectsTable',
        'assign-teachers': 'assignedTeachersTable'
    };
    
    const tableId = tableIdMap[sectionId];
    if (!tableId) return;
    
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // التحقق من وجود شريط البحث مسبقاً
    const existingSearch = table.parentElement.querySelector('.table-search-container');
    if (existingSearch) return;
    
    // إنشاء شريط البحث
    const searchContainer = document.createElement('div');
    searchContainer.className = 'table-search-container';
    searchContainer.innerHTML = `
        <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" class="table-search-input" 
                   placeholder="ابحث في القائمة..." 
                   onkeyup="handleSearch('${sectionId}', this.value)">
            <button class="clear-search" onclick="clearSearch('${sectionId}', this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="search-info">
            <span class="results-count">0 نتيجة</span>
        </div>
    `;
    
    // إضافة الأنماط إذا لم تكن موجودة
    if (!document.querySelector('#search-styles')) {
        const style = document.createElement('style');
        style.id = 'search-styles';
        style.textContent = `
            .table-search-container {
                background: white;
                padding: 15px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 8px 8px 0 0;
            }
            .search-box {
                position: relative;
                width: 300px;
            }
            .search-box i {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #999;
            }
            .table-search-input {
                width: 100%;
                padding: 10px 40px 10px 15px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.3s;
            }
            .table-search-input:focus {
                outline: none;
                border-color: #3498db;
                box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
            }
            .clear-search {
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                display: none;
            }
            .search-info {
                font-size: 14px;
                color: #666;
            }
            @media (max-width: 768px) {
                .table-search-container {
                    flex-direction: column;
                    gap: 10px;
                    align-items: stretch;
                }
                .search-box {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // إضافة شريط البحث قبل الجدول
    table.parentElement.insertBefore(searchContainer, table);
}

function handleSearch(sectionId, searchTerm) {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
        const tableIdMap = {
            'students': 'adminStudentsTable',
            'users': 'adminUsersTable',
            'grades-list': 'gradesListTable',
            'evaluations': 'evaluationsTable',
            'medical-history': 'medicalHistoryTable',
            'children': 'specialistChildrenTable',
            'my-students': 'teacherStudentsTable',
            'subjects': 'adminSubjectsTable',
            'assign-teachers': 'assignedTeachersTable'
        };
        
        const tableId = tableIdMap[sectionId];
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');
        let visibleCount = 0;
        
        // إظهار زر مسح البحث إذا كان هناك نص
        const clearBtn = table.parentElement.querySelector('.clear-search');
        if (clearBtn) {
            clearBtn.style.display = searchTerm ? 'block' : 'none';
        }
        
        rows.forEach(row => {
            if (row.classList.contains('no-data') || row.classList.contains('no-results')) {
                row.style.display = 'none';
                return;
            }
            
            // تجميع النص من جميع الخلايا باستثناء أزرار الإجراءات
            let rowText = '';
            const cells = row.cells;
            for (let i = 0; i < cells.length - 1; i++) { // تجاهل آخر عمود (الإجراءات)
                const cell = cells[i];
                // إزالة أي أزرار أو أيقونات من النص
                const cellClone = cell.cloneNode(true);
                const buttons = cellClone.querySelectorAll('button, .btn-icon, .action-buttons, .status-badge, .role-badge');
                buttons.forEach(btn => btn.remove());
                rowText += ' ' + cellClone.textContent.trim();
            }
            
            const searchLower = searchTerm.toLowerCase().trim();
            
            if (!searchLower || rowText.toLowerCase().includes(searchLower)) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // تحديث عدد النتائج
        const resultsCount = table.parentElement.querySelector('.results-count');
        if (resultsCount) {
            resultsCount.textContent = `${visibleCount} نتيجة`;
        }
        
        // إظهار رسالة إذا لم توجد نتائج
        if (visibleCount === 0 && rows.length > 0) {
            const existingNoResults = tbody.querySelector('.no-results');
            if (!existingNoResults) {
                const noResultsRow = document.createElement('tr');
                noResultsRow.className = 'no-results';
                noResultsRow.innerHTML = `
                    <td colspan="${rows[0].cells.length}">
                        <div class="no-results-message">
                            <i class="fas fa-search"></i>
                            <p>لا توجد نتائج تطابق "${searchTerm}"</p>
                        </div>
                    </td>
                `;
                tbody.appendChild(noResultsRow);
            }
        } else {
            // إزالة رسالة عدم وجود نتائج إذا كانت موجودة
            const noResults = tbody.querySelector('.no-results');
            if (noResults) {
                noResults.remove();
            }
        }
    }, 300);
}

function clearSearch(sectionId, button) {
    const tableIdMap = {
        'students': 'adminStudentsTable',
        'users': 'adminUsersTable',
        'grades-list': 'gradesListTable',
        'evaluations': 'evaluationsTable',
        'medical-history': 'medicalHistoryTable',
        'children': 'specialistChildrenTable',
        'my-students': 'teacherStudentsTable',
        'subjects': 'adminSubjectsTable',
        'assign-teachers': 'assignedTeachersTable'
    };
    
    const tableId = tableIdMap[sectionId];
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const searchInput = table.parentElement.querySelector('.table-search-input');
    if (searchInput) {
        searchInput.value = '';
        handleSearch(sectionId, '');
    }
    
    if (button) {
        button.style.display = 'none';
    }
}

// ============================================
// 6. نظام المواد الدراسية وتعيين المعلمين - محسن
// ============================================

function loadSubjects() {
    return database.ref('subjects').once('value')
        .then(snapshot => {
            subjects = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    subjects.push({
                        id: child.key,
                        ...child.val()
                    });
                });
            }
            return subjects;
        });
}

function populateSubjectsSelect() {
    const subjectSelect = document.getElementById('userSubject');
    const assignSubjectSelect = document.getElementById('assignSubject');
    
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">اختر المادة الدراسية</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            subjectSelect.appendChild(option);
        });
    }
    
    if (assignSubjectSelect) {
        assignSubjectSelect.innerHTML = '<option value="">اختر المادة</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            assignSubjectSelect.appendChild(option);
        });
    }
}

function loadSubjectsList() {
    const tbody = document.getElementById('adminSubjectsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (subjects.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="5">
                    <i class="fas fa-info-circle"></i>
                    <span>لا توجد مواد دراسية حتى الآن</span>
                </td>
            </tr>
        `;
        return;
    }
    
    // استخدام Promise.all لتحسين الأداء
    const promises = subjects.map((subject, index) => {
        return database.ref('users').orderByChild('subjectId').equalTo(subject.id).once('value')
            .then(snapshot => {
                const teacherCount = snapshot.exists() ? snapshot.numChildren() : 0;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${subject.name}</td>
                    <td>${subject.description || 'لا يوجد وصف'}</td>
                    <td>${teacherCount}</td>
                    <td>
                        <button type="button" class="btn-icon edit" onclick="editSubject('${subject.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-icon delete" onclick="confirmDeleteSubject('${subject.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                return row;
            });
    });
    
    Promise.all(promises).then(rows => {
        rows.forEach(row => tbody.appendChild(row));
    });
}

function showAddSubjectModal() {
    const modalHtml = `
        <div id="addSubjectModal" class="modal-overlay active">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-book-open"></i> إضافة مادة دراسية جديدة</h3>
                    <button class="modal-close" onclick="closeModal('addSubjectModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="addSubjectForm" class="form-container">
                        <div class="form-group">
                            <label for="subjectName">اسم المادة *</label>
                            <input type="text" id="subjectName" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="subjectDescription">وصف المادة</label>
                            <textarea id="subjectDescription" rows="3"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('addSubjectModal')">إلغاء</button>
                            <button type="submit" class="btn btn-primary">حفظ المادة</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('addSubjectForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addNewSubject();
    });
}

function addNewSubject() {
    const subjectData = {
        name: document.getElementById('subjectName').value.trim(),
        description: document.getElementById('subjectDescription').value.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (!subjectData.name) {
        showToast('يرجى إدخال اسم المادة', 'error');
        return;
    }
    
    showLoading();
    
    database.ref('subjects').push().set(subjectData)
        .then(() => {
            showToast('تم إضافة المادة بنجاح', 'success');
            closeModal('addSubjectModal');
            loadSubjects().then(() => {
                populateSubjectsSelect();
                loadSubjectsList();
            });
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في إضافة المادة:', error);
            showToast('حدث خطأ أثناء إضافة المادة', 'error');
            hideLoading();
        });
}

function editSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) {
        showToast('المادة غير موجودة', 'error');
        return;
    }
    
    const modalHtml = `
        <div id="editSubjectModal" class="modal-overlay active">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-book-open"></i> تعديل المادة الدراسية</h3>
                    <button class="modal-close" onclick="closeModal('editSubjectModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="editSubjectForm" class="form-container">
                        <input type="hidden" id="editSubjectId" value="${subjectId}">
                        <div class="form-group">
                            <label for="editSubjectName">اسم المادة *</label>
                            <input type="text" id="editSubjectName" value="${subject.name}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="editSubjectDescription">وصف المادة</label>
                            <textarea id="editSubjectDescription" rows="3">${subject.description || ''}</textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('editSubjectModal')">إلغاء</button>
                            <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('editSubjectForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateSubject(subjectId);
    });
}

function updateSubject(subjectId) {
    const subjectData = {
        name: document.getElementById('editSubjectName').value.trim(),
        description: document.getElementById('editSubjectDescription').value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    
    if (!subjectData.name) {
        showToast('يرجى إدخال اسم المادة', 'error');
        return;
    }
    
    showLoading();
    
    database.ref('subjects/' + subjectId).update(subjectData)
        .then(() => {
            showToast('تم تحديث المادة بنجاح', 'success');
            closeModal('editSubjectModal');
            loadSubjects().then(() => {
                populateSubjectsSelect();
                loadSubjectsList();
            });
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تحديث المادة:', error);
            showToast('حدث خطأ أثناء تحديث المادة', 'error');
            hideLoading();
        });
}

function confirmDeleteSubject(subjectId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذه المادة؟\n\nملاحظة: سيتم إزالة هذه المادة من جميع المعلمين المرتبطين بها.')) {
        showLoading();
        
        // التحقق أولاً إذا كانت المادة مرتبطة بأي معلم
        database.ref('users').orderByChild('subjectId').equalTo(subjectId).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    // إزالة المادة من جميع المعلمين المرتبطين
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['users/' + child.key + '/subjectId'] = '';
                    });
                    return database.ref().update(updates)
                        .then(() => database.ref('subjects/' + subjectId).remove());
                } else {
                    return database.ref('subjects/' + subjectId).remove();
                }
            })
            .then(() => {
                showToast('تم حذف المادة بنجاح', 'success');
                loadSubjects().then(() => {
                    populateSubjectsSelect();
                    loadSubjectsList();
                });
                hideLoading();
            })
            .catch(error => {
                console.error('خطأ في حذف المادة:', error);
                showToast('حدث خطأ أثناء حذف المادة', 'error');
                hideLoading();
            });
    }
}

function loadAssignTeachersData() {
    const studentSelect = document.getElementById('assignStudent');
    const teacherSelect = document.getElementById('assignTeacher');
    
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">اختر الطالب</option>';
        database.ref('students').once('value').then(snapshot => {
            snapshot.forEach(child => {
                const student = child.val();
                const option = document.createElement('option');
                option.value = child.key;
                option.textContent = student.fullName + (student.gradeLevel ? ' - ' + student.gradeLevel : '');
                studentSelect.appendChild(option);
            });
        }).catch(error => {
            console.error('خطأ في تحميل الطلاب:', error);
        });
    }
    
    if (teacherSelect) {
        teacherSelect.innerHTML = '<option value="">اختر المعلم</option>';
        database.ref('users').orderByChild('role').equalTo('teacher').once('value').then(snapshot => {
            snapshot.forEach(child => {
                const teacher = child.val();
                const option = document.createElement('option');
                option.value = child.key;
                option.textContent = `${teacher.fullName} - ${teacher.subjectId ? getSubjectName(teacher.subjectId) : 'بدون مادة'}`;
                option.dataset.subject = teacher.subjectId || '';
                teacherSelect.appendChild(option);
            });
        }).catch(error => {
            console.error('خطأ في تحميل المعلمين:', error);
        });
    }
}

function loadStudentTeachers() {
    const studentId = document.getElementById('assignStudent').value;
    if (!studentId) return;
    
    const tbody = document.getElementById('assignedTeachersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    
    database.ref('student_teachers').orderByChild('studentId').equalTo(studentId).once('value')
        .then(snapshot => {
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="6">
                            <i class="fas fa-info-circle"></i>
                            <span>لا يوجد معلمون مرتبطون</span>
                        </td>
                    </tr>
                `;
                return;
            }
            
            const promises = [];
            const assignments = [];
            
            snapshot.forEach(child => {
                const assignment = child.val();
                const assignmentId = child.key;
                assignments.push({ assignment, assignmentId });
                
                const promise = Promise.all([
                    database.ref('users/' + assignment.teacherId).once('value'),
                    database.ref('subjects/' + assignment.subjectId).once('value')
                ]).then(([teacherSnapshot, subjectSnapshot]) => {
                    const teacher = teacherSnapshot.val();
                    const subject = subjectSnapshot.val();
                    
                    return {
                        teacher: teacher || { fullName: 'غير محدد', email: 'غير محدد', phone: 'لا يوجد' },
                        subject: subject || { name: 'غير محدد' },
                        assignmentId: assignmentId
                    };
                });
                
                promises.push(promise);
            });
            
            Promise.all(promises).then(results => {
                tbody.innerHTML = '';
                
                if (results.length === 0) {
                    tbody.innerHTML = `
                        <tr class="no-data">
                            <td colspan="6">
                                <i class="fas fa-info-circle"></i>
                                <span>لا يوجد معلمون مرتبطون</span>
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                results.forEach((result, index) => {
                    const { teacher, subject, assignmentId } = result;
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${teacher.fullName}</td>
                        <td>${subject.name}</td>
                        <td>${teacher.email}</td>
                        <td>${teacher.phone || 'لا يوجد'}</td>
                        <td>
                            <button type="button" class="btn-icon delete" onclick="removeTeacherAssignment('${assignmentId}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }).catch(error => {
                console.error('خطأ في تحميل بيانات المعلمين:', error);
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="6">
                            <i class="fas fa-exclamation-circle"></i>
                            <span>حدث خطأ في تحميل البيانات</span>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(error => {
            console.error('خطأ في تحميل المعلمين المرتبطين:', error);
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>حدث خطأ في تحميل البيانات</span>
                    </td>
                </tr>
            `;
        });
}

function removeTeacherAssignment(assignmentId) {
    if (confirm('⚠️ هل أنت متأكد من إزالة هذا المعلم؟')) {
        showLoading();
        
        database.ref('student_teachers/' + assignmentId).remove()
            .then(() => {
                showToast('تم إزالة المعلم بنجاح', 'success');
                loadStudentTeachers();
                hideLoading();
            })
            .catch(error => {
                console.error('خطأ في إزالة المعلم:', error);
                showToast('حدث خطأ أثناء إزالة المعلم', 'error');
                hideLoading();
            });
    }
}

function clearAssignForm() {
    const form = document.getElementById('assignTeacherForm');
    if (form) {
        form.reset();
    }
    const tbody = document.getElementById('assignedTeachersTableBody');
    if (tbody) {
        tbody.innerHTML = '';
    }
}

function handleAssignTeacher(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('assignStudent').value;
    const teacherId = document.getElementById('assignTeacher').value;
    const subjectId = document.getElementById('assignSubject').value;
    
    if (!studentId || !teacherId || !subjectId) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    // التحقق من أن المعلم يدرس هذه المادة
    const teacherOption = document.getElementById('assignTeacher').options[document.getElementById('assignTeacher').selectedIndex];
    const teacherSubject = teacherOption.dataset.subject;
    
    if (teacherSubject !== subjectId) {
        showToast('هذا المعلم لا يدرس هذه المادة', 'error');
        return;
    }
    
    showLoading();
    
    // التحقق من عدم وجود تعيين مسبق لنفس الطالب والمعلم والمادة
    database.ref('student_teachers').orderByChild('studentId').equalTo(studentId).once('value')
        .then(snapshot => {
            let assignmentExists = false;
            snapshot.forEach(child => {
                const assignment = child.val();
                if (assignment.teacherId === teacherId && assignment.subjectId === subjectId) {
                    assignmentExists = true;
                }
            });
            
            if (assignmentExists) {
                throw new Error('هذا المعلم مرتبط بالفعل بهذا الطالب في نفس المادة');
            }
            
            const assignmentData = {
                studentId: studentId,
                teacherId: teacherId,
                subjectId: subjectId,
                assignedAt: new Date().toISOString(),
                assignedBy: currentUser.uid
            };
            
            return database.ref('student_teachers').push().set(assignmentData);
        })
        .then(() => {
            showToast('تم تعيين المعلم للطالب بنجاح', 'success');
            clearAssignForm();
            loadStudentTeachers();
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تعيين المعلم:', error);
            showToast(error.message || 'حدث خطأ أثناء تعيين المعلم', 'error');
            hideLoading();
        });
}

function getSubjectName(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'غير محدد';
}

function loadMyTeachers() {
    const studentId = currentUser.uid;
    const container = document.getElementById('myTeachersContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-placeholder"><p><i class="fas fa-spinner fa-spin"></i> جاري تحميل بيانات المعلمين...</p></div>';
    
    database.ref('student_teachers').orderByChild('studentId').equalTo(studentId).once('value')
        .then(snapshot => {
            container.innerHTML = '';
            
            if (!snapshot.exists()) {
                container.innerHTML = `
                    <div class="no-data">
                        <i class="fas fa-info-circle"></i>
                        <span>لا توجد معلمين مرتبطين حتى الآن</span>
                    </div>
                `;
                return;
            }
            
            const promises = [];
            const teachers = [];
            
            snapshot.forEach(child => {
                const assignment = child.val();
                
                const promise = Promise.all([
                    database.ref('users/' + assignment.teacherId).once('value'),
                    database.ref('subjects/' + assignment.subjectId).once('value')
                ]).then(([teacherSnapshot, subjectSnapshot]) => {
                    const teacher = teacherSnapshot.val();
                    const subject = subjectSnapshot.val();
                    
                    return {
                        teacher: teacher || { fullName: 'غير محدد', email: 'غير محدد', phone: 'لا يوجد' },
                        subject: subject || { name: 'غير محدد' }
                    };
                });
                
                promises.push(promise);
            });
            
            Promise.all(promises).then(results => {
                container.innerHTML = '';
                
                results.forEach((result, index) => {
                    const { teacher, subject } = result;
                    
                    const teacherCard = document.createElement('div');
                    teacherCard.className = 'teacher-card';
                    teacherCard.innerHTML = `
                        <div class="teacher-header">
                            <div class="teacher-avatar">
                                <i class="fas fa-chalkboard-teacher"></i>
                            </div>
                            <div class="teacher-info">
                                <h3>${teacher.fullName}</h3>
                                <span class="teacher-subject">${subject.name}</span>
                            </div>
                        </div>
                        <div class="teacher-details">
                            <div class="teacher-detail">
                                <i class="fas fa-envelope"></i>
                                <span>${teacher.email}</span>
                            </div>
                            <div class="teacher-detail">
                                <i class="fas fa-phone"></i>
                                <span>${teacher.phone || 'لا يوجد رقم هاتف'}</span>
                            </div>
                        </div>
                    `;
                    container.appendChild(teacherCard);
                });
            }).catch(error => {
                console.error('خطأ في تحميل بيانات المعلمين:', error);
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>حدث خطأ في تحميل بيانات المعلمين</span>
                    </div>
                `;
            });
        })
        .catch(error => {
            console.error('خطأ في تحميل المعلمين:', error);
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>حدث خطأ في تحميل بيانات المعلمين</span>
                </div>
            `;
        });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// ============================================
// 7. نظام إدارة المشرف (admin.html) - محسن
// ============================================
function initAdminDashboard() {
    checkAuth('admin').then(() => {
        loadAdminData();
        loadStatistics();
        loadStudentsList();
        loadUsersList();
        setupAdminForms();
        setCurrentDate();
        loadParentsForSelect();

        // تحميل المواد الدراسية وإعداد النماذج
        loadSubjects().then(() => {
            populateSubjectsSelect();
            loadSubjectsList();
            loadAssignTeachersData();
            
            // ربط حدث submit لنموذج تعيين المعلمين
            const assignTeacherForm = document.getElementById('assignTeacherForm');
            if (assignTeacherForm) {
                assignTeacherForm.addEventListener('submit', handleAssignTeacher);
            }
        });

        hideLoading();
        
        // تهيئة البحث عند تحميل الصفحة
        setTimeout(() => {
            initSearch('students');
            initSearch('users');
            initSearch('subjects');
            adjustContentHeight();
        }, 800);
    }).catch(error => {
        console.error('خطأ في المصادقة:', error);
        window.location.href = 'index.html';
    });
}

function loadAdminData() {
    if (currentUser && currentUserData) {
        const adminNameElements = document.querySelectorAll('#adminName, #adminWelcomeName');
        adminNameElements.forEach(element => {
            if (element) {
                element.textContent = currentUserData.fullName || 'المشرف الرئيسي';
            }
        });
        
        const userEmailElement = document.getElementById('currentUserEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
    }
}

function loadStatistics() {
    Promise.all([
        database.ref('students').once('value'),
        database.ref('users').once('value')
    ])
    .then(([studentsSnapshot, usersSnapshot]) => {
        const totalStudents = studentsSnapshot.numChildren();
        document.getElementById('totalStudents').textContent = totalStudents;
        
        let specialists = 0;
        let teachers = 0;
        let parents = 0;
        
        usersSnapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            switch(user.role) {
                case 'specialist':
                    specialists++;
                    break;
                case 'teacher':
                    teachers++;
                    break;
                case 'parent':
                    parents++;
                    break;
            }
        });
        
        document.getElementById('totalSpecialists').textContent = specialists;
        document.getElementById('totalTeachers').textContent = teachers;
        document.getElementById('totalParents').textContent = parents;
    })
    .catch((error) => {
        console.error('خطأ في تحميل الإحصائيات:', error);
    });
}

function loadParentsForSelect() {
    database.ref('users').orderByChild('role').equalTo('parent').once('value')
        .then((snapshot) => {
            const parentSelect = document.getElementById('parentId');
            const editParentSelect = document.getElementById('editParentId');
            
            if (parentSelect) {
                parentSelect.innerHTML = '<option value="">اختر ولي الأمر</option>';
            }
            if (editParentSelect) {
                editParentSelect.innerHTML = '<option value="">اختر ولي الأمر</option>';
            }
            
            if (!snapshot.exists()) {
                if (parentSelect) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'لا توجد أولياء أمور مسجلين';
                    parentSelect.appendChild(option);
                }
                if (editParentSelect) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'لا توجد أولياء أمور مسجلين';
                    editParentSelect.appendChild(option);
                }
                return;
            }
            
            snapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                const userId = childSnapshot.key;
                
                if (parentSelect) {
                    const option = document.createElement('option');
                    option.value = userId;
                    const phoneText = user.phone ? ` - ${user.phone}` : '';
                    option.textContent = `${user.fullName}${phoneText}`;
                    option.dataset.phone = user.phone || '';
                    option.dataset.name = user.fullName || '';
                    parentSelect.appendChild(option);
                }
                
                if (editParentSelect) {
                    const option = document.createElement('option');
                    option.value = userId;
                    const phoneText = user.phone ? ` - ${user.phone}` : '';
                    option.textContent = `${user.fullName}${phoneText}`;
                    option.dataset.phone = user.phone || '';
                    option.dataset.name = user.fullName || '';
                    editParentSelect.appendChild(option);
                }
            });
        })
        .catch((error) => {
            console.error('خطأ في تحميل أولياء الأمور:', error);
            showToast('حدث خطأ في تحميل قائمة أولياء الأمور', 'error');
        });
}

function updateParentInfo() {
    const parentSelect = document.getElementById('parentId');
    const parentNameInput = document.getElementById('parentName');
    const parentPhoneInput = document.getElementById('parentPhone');
    const parentIdInput = document.getElementById('parentIdInput');
    
    if (parentSelect && parentNameInput && parentPhoneInput && parentIdInput) {
        const selectedOption = parentSelect.options[parentSelect.selectedIndex];
        
        if (parentSelect.value) {
            parentNameInput.value = selectedOption.dataset.name || selectedOption.textContent.split(' - ')[0];
            parentIdInput.value = parentSelect.value;
            parentPhoneInput.value = selectedOption.dataset.phone || '';
        } else {
            parentNameInput.value = '';
            parentIdInput.value = '';
            parentPhoneInput.value = '';
        }
    }
}

function loadStudentsList() {
    showLoading();
    
    Promise.all([
        database.ref('students').once('value'),
        database.ref('users').orderByChild('role').equalTo('parent').once('value')
    ])
    .then(([studentsSnapshot, parentsSnapshot]) => {
        const tbody = document.getElementById('adminStudentsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!studentsSnapshot.exists()) {
            tbody.innerHTML = `
                <tr class="no-data">
                    <td colspan="9">
                        <i class="fas fa-info-circle"></i>
                        <span>لا توجد طلاب مسجلين حتى الآن</span>
                    </td>
                </tr>
            `;
            hideLoading();
            return;
        }
        
        // إنشاء خريطة لأسماء وأرقام هواتف أولياء الأمور
        const parentsMap = {};
        parentsSnapshot.forEach((userSnapshot) => {
            const user = userSnapshot.val();
            parentsMap[userSnapshot.key] = {
                name: user.fullName || 'غير محدد',
                phone: user.phone || 'غير محدد'
            };
        });
        
        const rows = [];
        let index = 1;
        
        studentsSnapshot.forEach((childSnapshot) => {
            const student = childSnapshot.val();
            const studentId = childSnapshot.key;
            
            // الحصول على اسم ولي الأمر
            let parentName = 'غير محدد';
            let parentPhone = student.parentPhone || 'غير محدد';
            let parentId = student.parentId || '';
            
            if (parentId && parentsMap[parentId]) {
                parentName = parentsMap[parentId].name;
                if (!parentPhone || parentPhone === 'غير محدد') {
                    parentPhone = parentsMap[parentId].phone;
                }
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index}</td>
                <td>${student.fullName || 'غير محدد'}</td>
                <td>${student.studentId || 'غير محدد'}</td>
                <td>${student.birthDate || 'غير محدد'}</td>
                <td>${student.disabilityType || 'غير محدد'}</td>
                <td>${parentPhone}</td>
                <td>${parentName}</td>
                <td><span class="status-badge active">نشط</span></td>
                <td>
                    <button type="button" class="btn-icon edit" onclick="editStudent('${studentId}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn-icon delete" onclick="confirmDeleteStudent('${studentId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            rows.push(row);
            index++;
        });
        
        rows.forEach(row => tbody.appendChild(row));
        hideLoading();
    })
    .catch((error) => {
        console.error('خطأ في تحميل قائمة الطلاب:', error);
        showToast('حدث خطأ في تحميل قائمة الطلاب', 'error');
        hideLoading();
    });
}

function loadUsersList() {
    showLoading();
    
    database.ref('users').once('value')
        .then((snapshot) => {
            const tbody = document.getElementById('adminUsersTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="7">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد مستخدمين مسجلين حتى الآن</span>
                        </td>
                    </tr>
                `;
                hideLoading();
                return;
            }
            
            const rows = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                const userId = childSnapshot.key;
                
                if (userId === currentUser.uid) return;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index}</td>
                    <td>${user.fullName || 'غير محدد'}</td>
                    <td>${user.email || 'غير محدد'}</td>
                    <td><span class="role-badge ${user.role}">${getRoleName(user.role)}</span></td>
                    <td>${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ar-EG') : 'غير محدد'}</td>
                    <td><span class="status-badge ${user.status === 'inactive' ? 'inactive' : 'active'}">${user.status === 'inactive' ? 'غير نشط' : 'نشط'}</span></td>
                    <td>
                        <button type="button" class="btn-icon edit" onclick="editUser('${userId}')" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-icon delete" onclick="confirmDeleteUser('${userId}')" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                rows.push(row);
                index++;
            });
            
            if (rows.length === 0) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="7">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد مستخدمين مسجلين حتى الآن</span>
                        </td>
                    </tr>
                `;
            } else {
                rows.forEach(row => tbody.appendChild(row));
            }
            
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل قائمة المستخدمين:', error);
            showToast('حدث خطأ في تحميل قائمة المستخدمين', 'error');
            hideLoading();
        });
}

function getRoleName(role) {
    const roles = {
        'admin': 'مشرف',
        'specialist': 'أخصائي',
        'teacher': 'معلم',
        'parent': 'ولي أمر',
        'student': 'طالب'
    };
    return roles[role] || role;
}

function setupAdminForms() {
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', handleAddStudent);
    }
    
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }

    const assignTeacherForm = document.getElementById('assignTeacherForm');
    if (assignTeacherForm) {
        assignTeacherForm.addEventListener('submit', handleAssignTeacher);
    }
}

function handleAddStudent(e) {
    e.preventDefault();
    
    const studentData = {
        fullName: document.getElementById('studentName').value.trim(),
        studentId: document.getElementById('studentId').value.trim(),
        birthDate: document.getElementById('birthDate').value,
        disabilityType: document.getElementById('disabilityType').value,
        gradeLevel: document.getElementById('studentGrade').value,
        email: document.getElementById('studentEmail').value.trim() || '',
        parentId: document.getElementById('parentId').value.trim() || '',
        parentPhone: document.getElementById('parentPhone').value.trim() || '',
        notes: document.getElementById('notes').value.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active'
    };
    
    // التحقق من الإدخال
    if (!studentData.fullName || !studentData.studentId || !studentData.birthDate || 
        !studentData.disabilityType || !studentData.gradeLevel) {
        showToast('يرجى ملء جميع الحقول المطلوبة (*)', 'error');
        return;
    }
    
    if (!validateBirthDate(studentData.birthDate)) {
        showToast('تاريخ الميلاد يجب أن يكون تاريخاً صحيحاً ولا يكون في المستقبل', 'error');
        return;
    }
    
    if (studentData.email && !validateEmail(studentData.email)) {
        showToast('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (studentData.parentPhone && !validatePhone(studentData.parentPhone)) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }
    
    showLoading();
    
    // التحقق من عدم وجود طالب بنفس رقم الهوية
    database.ref('students').orderByChild('studentId').equalTo(studentData.studentId).once('value')
        .then(existingSnapshot => {
            if (existingSnapshot.exists()) {
                throw new Error('يوجد طالب مسجل بنفس رقم الهوية');
            }
            
            const newStudentRef = database.ref('students').push();
            return newStudentRef.set(studentData);
        })
        .then(() => {
            showToast('تم إضافة الطالب بنجاح!', 'success');
            document.getElementById('addStudentForm').reset();
            
            loadStatistics();
            loadStudentsList();
            
            showSection('students');
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في إضافة الطالب:', error);
            showToast(error.message || 'حدث خطأ أثناء إضافة الطالب', 'error');
            hideLoading();
        });
}

function handleAddUser(e) {
    e.preventDefault();
    
    const userData = {
        fullName: document.getElementById('userFullName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value,
        phone: document.getElementById('userPhone').value.trim() || '',
        registeredAt: new Date().toISOString(),
        status: 'active'
    };

    if (userData.role === 'teacher') {
        userData.subjectId = document.getElementById('userSubject').value;
    }

    // التحقق من الإدخال
    if (!userData.fullName || !userData.email || !userData.password || !userData.role) {
        showToast('يرجى ملء جميع الحقول المطلوبة (*)', 'error');
        return;
    }
    
    if (!validateEmail(userData.email)) {
        showToast('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (userData.password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    if (userData.phone && !validatePhone(userData.phone)) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }
    
    if (userData.role === 'teacher' && !userData.subjectId) {
        showToast('يرجى اختيار المادة الدراسية للمعلم', 'error');
        return;
    }
    
    showLoading();
    
    firebase.auth().createUserWithEmailAndPassword(userData.email, userData.password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            const userToSave = {
                fullName: userData.fullName,
                email: userData.email,
                role: userData.role,
                phone: userData.phone,
                subjectId: userData.subjectId || '',
                registeredAt: userData.registeredAt,
                status: userData.status,
                uid: user.uid
            };
            
            return database.ref('users/' + user.uid).set(userToSave);
        })
        .then(() => {
            showToast('تم إضافة المستخدم بنجاح!', 'success');
            document.getElementById('addUserForm').reset();
            
            loadStatistics();
            loadUsersList();
            
            showSection('users');
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في إضافة المستخدم:', error);
            
            let errorMessage = 'حدث خطأ أثناء إضافة المستخدم';
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'عملية إنشاء الحساب غير مسموح بها حالياً';
                    break;
            }
            
            showToast(errorMessage, 'error');
            hideLoading();
        });
}

function confirmDeleteStudent(studentId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا الطالب؟\n\nملاحظة: سيتم حذف جميع البيانات المرتبطة بالطالب (الدرجات، التقييمات، السجلات الطبية، تعيينات المعلمين).\n\nهذا الإجراء لا يمكن التراجع عنه.')) {
        showLoading();
        
        // حذف جميع البيانات المرتبطة بالطالب
        const deletePromises = [
            database.ref('students/' + studentId).remove(),
            // حذف الدرجات
            database.ref('grades').orderByChild('studentId').equalTo(studentId).once('value')
                .then(snapshot => {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['grades/' + child.key] = null;
                    });
                    return database.ref().update(updates);
                }),
            // حذف التقييمات
            database.ref('evaluations').orderByChild('studentId').equalTo(studentId).once('value')
                .then(snapshot => {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['evaluations/' + child.key] = null;
                    });
                    return database.ref().update(updates);
                }),
            // حذف السجلات الطبية
            database.ref('medicalHistory').orderByChild('studentId').equalTo(studentId).once('value')
                .then(snapshot => {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['medicalHistory/' + child.key] = null;
                    });
                    return database.ref().update(updates);
                }),
            // حذف تعيينات المعلمين
            database.ref('student_teachers').orderByChild('studentId').equalTo(studentId).once('value')
                .then(snapshot => {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['student_teachers/' + child.key] = null;
                    });
                    return database.ref().update(updates);
                })
        ];
        
        Promise.all(deletePromises)
            .then(() => {
                showToast('تم حذف الطالب وجميع بياناته المرتبطة بنجاح', 'success');
                loadStatistics();
                loadStudentsList();
                hideLoading();
            })
            .catch((error) => {
                console.error('خطأ في حذف الطالب:', error);
                showToast('حدث خطأ أثناء حذف الطالب', 'error');
                hideLoading();
            });
    }
}

function confirmDeleteUser(userId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا المستخدم؟\n\nملاحظة: سيتم تحديث جميع البيانات المرتبطة بهذا المستخدم.\n\nهذا الإجراء لا يمكن التراجع عنه.')) {
        showLoading();
        
        // جلب بيانات المستخدم أولاً لمعرفة دوره
        database.ref('users/' + userId).once('value')
            .then(snapshot => {
                const userData = snapshot.val();
                const role = userData.role;
                const email = userData.email;
                
                const promises = [];
                
                // حذف المستخدم من قاعدة البيانات
                promises.push(database.ref('users/' + userId).remove());
                
                // إذا كان ولي أمر، إزالة parentId من الطلاب
                if (role === 'parent') {
                    promises.push(
                        database.ref('students').orderByChild('parentId').equalTo(userId).once('value')
                            .then(studentSnapshot => {
                                const updates = {};
                                studentSnapshot.forEach(child => {
                                    updates['students/' + child.key + '/parentId'] = '';
                                });
                                return database.ref().update(updates);
                            })
                    );
                }
                
                // إذا كان معلم، حذف تعييناته
                if (role === 'teacher') {
                    promises.push(
                        database.ref('student_teachers').orderByChild('teacherId').equalTo(userId).once('value')
                            .then(teacherSnapshot => {
                                const updates = {};
                                teacherSnapshot.forEach(child => {
                                    updates['student_teachers/' + child.key] = null;
                                });
                                return database.ref().update(updates);
                            })
                    );
                }
                
                // إذا كان أخصائي، حذف تقييماته وسجلاته الطبية
                if (role === 'specialist') {
                    promises.push(
                        database.ref('evaluations').orderByChild('specialistId').equalTo(userId).once('value')
                            .then(evalSnapshot => {
                                const updates = {};
                                evalSnapshot.forEach(child => {
                                    updates['evaluations/' + child.key] = null;
                                });
                                return database.ref().update(updates);
                            })
                    );
                    promises.push(
                        database.ref('medicalHistory').orderByChild('specialistId').equalTo(userId).once('value')
                            .then(medicalSnapshot => {
                                const updates = {};
                                medicalSnapshot.forEach(child => {
                                    updates['medicalHistory/' + child.key] = null;
                                });
                                return database.ref().update(updates);
                            })
                    );
                }
                
                // حذف المستخدم من Authentication
                return Promise.all(promises)
                    .then(() => {
                        // يجب أن يكون المشرف مسجلاً الدخول لحذف المستخدم من Authentication
                        if (currentUser && currentUser.uid !== userId) {
                            return firebase.auth().getUserByEmail(email)
                                .then(userRecord => {
                                    return firebase.auth().deleteUser(userRecord.uid);
                                });
                        }
                    });
            })
            .then(() => {
                showToast('تم حذف المستخدم وجميع بياناته المرتبطة بنجاح', 'success');
                loadStatistics();
                loadUsersList();
                hideLoading();
            })
            .catch((error) => {
                console.error('خطأ في حذف المستخدم:', error);
                showToast('حدث خطأ أثناء حذف المستخدم', 'error');
                hideLoading();
            });
    }
}

function editStudent(studentId) {
    showLoading();
    
    database.ref('students/' + studentId).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                showToast('الطالب غير موجود', 'error');
                hideLoading();
                return;
            }
            
            const student = snapshot.val();
            
            // إنشاء نافذة التعديل
            const modalHtml = `
                <div id="editStudentModal" class="modal-overlay active">
                    <div class="modal-container" style="max-width: 600px;">
                        <div class="modal-header">
                            <h3><i class="fas fa-user-graduate"></i> تعديل الطالب</h3>
                            <button class="modal-close" onclick="closeEditStudentModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="editStudentForm" class="form-container">
                                <input type="hidden" id="editStudentId" value="${studentId}">
                                <input type="hidden" id="editParentIdInput" value="${student.parentId || ''}">
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editStudentName">الاسم الكامل *</label>
                                        <input type="text" id="editStudentName" value="${student.fullName || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="editStudentIdNum">رقم الهوية *</label>
                                        <input type="text" id="editStudentIdNum" value="${student.studentId || ''}" required>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editBirthDate">تاريخ الميلاد *</label>
                                        <input type="date" id="editBirthDate" value="${student.birthDate || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="editDisabilityType">نوع الإعاقة *</label>
                                        <select id="editDisabilityType" required>
                                            <option value="">اختر نوع الإعاقة</option>
                                            <option value="سمعية" ${student.disabilityType === 'سمعية' ? 'selected' : ''}>سمعية</option>
                                            <option value="بصرية" ${student.disabilityType === 'بصرية' ? 'selected' : ''}>بصرية</option>
                                            <option value="حركية" ${student.disabilityType === 'حركية' ? 'selected' : ''}>حركية</option>
                                            <option value="ذهنية" ${student.disabilityType === 'ذهنية' ? 'selected' : ''}>ذهنية</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editStudentGrade">الصف الدراسي *</label>
                                        <select id="editStudentGrade" required>
                                            <option value="">اختر الصف</option>
                                            <option value="الأول ابتدائي" ${student.gradeLevel === 'الأول ابتدائي' ? 'selected' : ''}>الأول ابتدائي</option>
                                            <option value="الثاني ابتدائي" ${student.gradeLevel === 'الثاني ابتدائي' ? 'selected' : ''}>الثاني ابتدائي</option>
                                            <option value="الثالث ابتدائي" ${student.gradeLevel === 'الثالث ابتدائي' ? 'selected' : ''}>الثالث ابتدائي</option>
                                            <option value="الرابع ابتدائي" ${student.gradeLevel === 'الرابع ابتدائي' ? 'selected' : ''}>الرابع ابتدائي</option>
                                            <option value="الخامس ابتدائي" ${student.gradeLevel === 'الخامس ابتدائي' ? 'selected' : ''}>الخامس ابتدائي</option>
                                            <option value="السادس ابتدائي" ${student.gradeLevel === 'السادس ابتدائي' ? 'selected' : ''}>السادس ابتدائي</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="editParentId">اختيار ولي الأمر</label>
                                        <select id="editParentId" onchange="updateEditParentInfo()">
                                            <option value="">اختر ولي الأمر</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editParentName">اسم ولي الأمر</label>
                                        <input type="text" id="editParentName" readonly value="${getParentName(student.parentId) || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label for="editParentPhone">رقم هاتف ولي الأمر</label>
                                        <input type="tel" id="editParentPhone" value="${student.parentPhone || ''}">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editStudentEmail">البريد الإلكتروني</label>
                                        <input type="email" id="editStudentEmail" value="${student.email || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label for="editStudentStatus">الحالة</label>
                                        <select id="editStudentStatus">
                                            <option value="active" ${student.status !== 'inactive' ? 'selected' : ''}>نشط</option>
                                            <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editNotes">ملاحظات</label>
                                    <textarea id="editNotes" rows="3">${student.notes || ''}</textarea>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="closeEditStudentModal()">إلغاء</button>
                                    <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            // إضافة النافذة إلى body
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer.firstElementChild);
            
            // تحميل أولياء الأمور للقائمة المنسدلة
            loadParentsForEdit(student.parentId || '', student.parentPhone || '');
            
            // ربط حدث submit للنموذج
            document.getElementById('editStudentForm').addEventListener('submit', function(e) {
                e.preventDefault();
                updateStudent(studentId);
            });
            
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل بيانات الطالب:', error);
            showToast('حدث خطأ في تحميل بيانات الطالب', 'error');
            hideLoading();
        });
}

function getParentName(parentId) {
    if (!parentId) return '';
    // هذا سيتم تحسينه عند تحميل أولياء الأمور
    return '';
}

function loadParentsForEdit(selectedParentId, selectedPhone) {
    database.ref('users').orderByChild('role').equalTo('parent').once('value')
        .then((snapshot) => {
            const parentSelect = document.getElementById('editParentId');
            if (!parentSelect) return;
            
            parentSelect.innerHTML = '<option value="">اختر ولي الأمر</option>';
            
            if (!snapshot.exists()) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'لا توجد أولياء أمور مسجلين';
                parentSelect.appendChild(option);
                return;
            }
            
            snapshot.forEach((childSnapshot) => {
                const user = childSnapshot.val();
                const userId = childSnapshot.key;
                
                const option = document.createElement('option');
                option.value = userId;
                const phoneText = user.phone ? ` - ${user.phone}` : '';
                option.textContent = `${user.fullName || 'غير محدد'}${phoneText}`;
                option.dataset.phone = user.phone || '';
                option.dataset.name = user.fullName || '';
                
                if (userId === selectedParentId) {
                    option.selected = true;
                    document.getElementById('editParentName').value = user.fullName || '';
                    if (!selectedPhone && user.phone) {
                        document.getElementById('editParentPhone').value = user.phone;
                    }
                }
                
                parentSelect.appendChild(option);
            });
        })
        .catch((error) => {
            console.error('خطأ في تحميل أولياء الأمور:', error);
        });
}

function updateEditParentInfo() {
    const parentSelect = document.getElementById('editParentId');
    const parentNameInput = document.getElementById('editParentName');
    const parentIdInput = document.getElementById('editParentIdInput');
    const parentPhoneInput = document.getElementById('editParentPhone');
    
    if (parentSelect && parentNameInput && parentIdInput && parentPhoneInput) {
        const selectedOption = parentSelect.options[parentSelect.selectedIndex];
        
        if (parentSelect.value) {
            parentNameInput.value = selectedOption.dataset.name || selectedOption.textContent.split(' - ')[0];
            parentIdInput.value = parentSelect.value;
            
            // تحديث رقم الهاتف فقط إذا كان فارغاً
            if (!parentPhoneInput.value.trim()) {
                parentPhoneInput.value = selectedOption.dataset.phone || '';
            }
        } else {
            parentNameInput.value = '';
            parentIdInput.value = '';
        }
    }
}

function updateStudent(studentId) {
    const studentData = {
        fullName: document.getElementById('editStudentName').value.trim(),
        studentId: document.getElementById('editStudentIdNum').value.trim(),
        birthDate: document.getElementById('editBirthDate').value,
        disabilityType: document.getElementById('editDisabilityType').value,
        gradeLevel: document.getElementById('editStudentGrade').value,
        email: document.getElementById('editStudentEmail').value.trim() || '',
        parentId: document.getElementById('editParentIdInput').value.trim() || '',
        parentPhone: document.getElementById('editParentPhone').value.trim() || '',
        notes: document.getElementById('editNotes').value.trim() || '',
        status: document.getElementById('editStudentStatus').value,
        updatedAt: new Date().toISOString()
    };
    
    // التحقق من الإدخال
    if (!studentData.fullName || !studentData.studentId || !studentData.birthDate || 
        !studentData.disabilityType || !studentData.gradeLevel) {
        showToast('يرجى ملء جميع الحقول المطلوبة (*)', 'error');
        return;
    }
    
    if (!validateBirthDate(studentData.birthDate)) {
        showToast('تاريخ الميلاد يجب أن يكون تاريخاً صحيحاً ولا يكون في المستقبل', 'error');
        return;
    }
    
    if (studentData.email && !validateEmail(studentData.email)) {
        showToast('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (studentData.parentPhone && !validatePhone(studentData.parentPhone)) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }
    
    showLoading();
    
    // التحقق من عدم وجود طالب آخر بنفس رقم الهوية (عدا الطالب الحالي)
    database.ref('students').orderByChild('studentId').equalTo(studentData.studentId).once('value')
        .then(existingSnapshot => {
            let studentExists = false;
            existingSnapshot.forEach((childSnapshot) => {
                if (childSnapshot.key !== studentId) {
                    studentExists = true;
                }
            });
            
            if (studentExists) {
                throw new Error('يوجد طالب آخر مسجل بنفس رقم الهوية');
            }
            
            return database.ref('students/' + studentId).update(studentData);
        })
        .then(() => {
            showToast('تم تحديث الطالب بنجاح!', 'success');
            closeEditStudentModal();
            loadStudentsList();
            loadStatistics();
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحديث الطالب:', error);
            showToast(error.message || 'حدث خطأ أثناء تحديث الطالب', 'error');
            hideLoading();
        });
}

function closeEditStudentModal() {
    const modal = document.getElementById('editStudentModal');
    if (modal) {
        modal.remove();
    }
}

function editUser(userId) {
    showLoading();
    
    database.ref('users/' + userId).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                showToast('المستخدم غير موجود', 'error');
                hideLoading();
                return;
            }
            
            const user = snapshot.val();
            
            // إنشاء نافذة التعديل
            const modalHtml = `
                <div id="editUserModal" class="modal-overlay active">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3><i class="fas fa-user-edit"></i> تعديل المستخدم</h3>
                            <button class="modal-close" onclick="closeEditUserModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="editUserForm" class="form-container">
                                <input type="hidden" id="editUserId" value="${userId}">
                                
                                <div class="form-group">
                                    <label for="editFullName">الاسم الكامل *</label>
                                    <input type="text" id="editFullName" value="${user.fullName || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editEmail">البريد الإلكتروني *</label>
                                    <input type="email" id="editEmail" value="${user.email || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editRole">الدور *</label>
                                    <select id="editRole" required>
                                        <option value="">اختر الدور</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مشرف</option>
                                        <option value="specialist" ${user.role === 'specialist' ? 'selected' : ''}>أخصائي</option>
                                        <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>معلم</option>
                                        <option value="parent" ${user.role === 'parent' ? 'selected' : ''}>ولي أمر</option>
                                        <option value="student" ${user.role === 'student' ? 'selected' : ''}>طالب</option>
                                    </select>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editPhone">رقم الهاتف</label>
                                        <input type="tel" id="editPhone" value="${user.phone || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label for="editStatus">الحالة</label>
                                        <select id="editStatus">
                                            <option value="active" ${user.status !== 'inactive' ? 'selected' : ''}>نشط</option>
                                            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
                                        </select>
                                    </div>
                                </div>
                                
                                ${user.role === 'teacher' ? `
                                <div class="form-group">
                                    <label for="editSubjectId">المادة الدراسية (للمعلمين فقط)</label>
                                    <select id="editSubjectId">
                                        <option value="">اختر المادة الدراسية</option>
                                    </select>
                                </div>
                                ` : ''}
                                
                                <div class="form-group">
                                    <label for="editPassword">كلمة المرور الجديدة (اختياري)</label>
                                    <div class="password-input">
                                        <input type="password" id="editPassword" placeholder="اتركه فارغاً للحفاظ على كلمة المرور الحالية">
                                        <button type="button" class="toggle-password" onclick="toggleEditPassword()">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                    <small class="form-text">اترك الحقل فارغاً إذا كنت لا تريد تغيير كلمة المرور</small>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="closeEditUserModal()">إلغاء</button>
                                    <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            // إضافة النافذة إلى body
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer.firstElementChild);
            
            // إضافة أنماط النافذة إذا لم تكن موجودة
            addModalStyles();
            
            // إذا كان المعلم، تحميل المواد الدراسية
            if (user.role === 'teacher') {
                loadSubjects().then(() => {
                    const subjectSelect = document.getElementById('editSubjectId');
                    if (subjectSelect) {
                        subjectSelect.innerHTML = '<option value="">اختر المادة الدراسية</option>';
                        subjects.forEach(subject => {
                            const option = document.createElement('option');
                            option.value = subject.id;
                            option.textContent = subject.name;
                            if (subject.id === user.subjectId) {
                                option.selected = true;
                            }
                            subjectSelect.appendChild(option);
                        });
                    }
                });
            }
            
            // ربط حدث submit للنموذج
            document.getElementById('editUserForm').addEventListener('submit', function(e) {
                e.preventDefault();
                updateUser(userId, user);
            });
            
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل بيانات المستخدم:', error);
            showToast('حدث خطأ في تحميل بيانات المستخدم', 'error');
            hideLoading();
        });
}

function updateUser(userId, oldUserData) {
    const userData = {
        fullName: document.getElementById('editFullName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        role: document.getElementById('editRole').value,
        phone: document.getElementById('editPhone').value.trim() || '',
        status: document.getElementById('editStatus').value,
        updatedAt: new Date().toISOString()
    };
    
    if (userData.role === 'teacher') {
        userData.subjectId = document.getElementById('editSubjectId') ? document.getElementById('editSubjectId').value : '';
    }
    
    const newPassword = document.getElementById('editPassword').value.trim();
    
    // التحقق من الإدخال
    if (!userData.fullName || !userData.email || !userData.role) {
        showToast('يرجى ملء جميع الحقول المطلوبة (*)', 'error');
        return;
    }
    
    if (!validateEmail(userData.email)) {
        showToast('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (userData.phone && !validatePhone(userData.phone)) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }
    
    if (newPassword && newPassword.length < 6) {
        showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    if (userData.role === 'teacher' && !userData.subjectId) {
        showToast('يرجى اختيار المادة الدراسية للمعلم', 'error');
        return;
    }
    
    showLoading();
    
    // تحديث البيانات في قاعدة البيانات
    const updatePromises = [];
    
    // إذا تغير البريد الإلكتروني، يجب تحديثه في Authentication
    if (oldUserData.email !== userData.email) {
        updatePromises.push(
            firebase.auth().currentUser.updateEmail(userData.email)
                .catch(error => {
                    if (error.code === 'auth/requires-recent-login') {
                        throw new Error('يجب إعادة تسجيل الدخول لتحديث البريد الإلكتروني');
                    }
                    throw error;
                })
        );
    }
    
    // إذا كانت هناك كلمة مرور جديدة، قم بتحديثها
    if (newPassword) {
        updatePromises.push(
            firebase.auth().currentUser.updatePassword(newPassword)
                .catch(error => {
                    if (error.code === 'auth/requires-recent-login') {
                        throw new Error('يجب إعادة تسجيل الدخول لتحديث كلمة المرور');
                    }
                    throw error;
                })
        );
    }
    
    // تحديث البيانات في قاعدة البيانات
    updatePromises.push(database.ref('users/' + userId).update(userData));
    
    Promise.all(updatePromises)
        .then(() => {
            showToast('تم تحديث المستخدم بنجاح!', 'success');
            closeEditUserModal();
            loadUsersList();
            loadStatistics();
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحديث المستخدم:', error);
            
            let errorMessage = 'حدث خطأ أثناء تحديث المستخدم';
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'البريد الإلكتروني غير صالح';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل';
                    break;
                default:
                    if (error.message) errorMessage = error.message;
            }
            
            showToast(errorMessage, 'error');
            hideLoading();
        });
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.remove();
    }
}

function toggleEditPassword() {
    const passwordInput = document.getElementById('editPassword');
    const eyeIcon = event.currentTarget.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

function addModalStyles() {
    if (!document.querySelector('#modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                right: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            
            .modal-container {
                background: white;
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-xl);
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                animation: slideUp 0.3s ease;
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: var(--dark-color);
                font-size: 18px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 18px;
                padding: 5px;
                border-radius: 4px;
                transition: all 0.2s;
            }
            
            .modal-close:hover {
                color: var(--danger-color);
                background: #f8f9fa;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-body .form-container {
                box-shadow: none;
                padding: 0;
            }
            
            .form-text {
                display: block;
                margin-top: 5px;
                color: #666;
                font-size: 12px;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// 8. نظام إدارة الطالب (student.html) - محسن
// ============================================
function initStudentDashboard() {
    checkAuth('student').then(() => {
        loadStudentData();
        loadStudentGrades();
        setCurrentDate();
        loadMyTeachers();
        hideLoading();
    }).catch(error => {
        console.error('خطأ في المصادقة:', error);
        window.location.href = 'index.html';
    });
}

function loadStudentData() {
    if (currentUser && currentUserData) {
        const studentNameElements = document.querySelectorAll('#studentName, #studentWelcomeName, #profileStudentName');
        studentNameElements.forEach(element => {
            if (element) {
                element.textContent = currentUserData.fullName || 'الطالب';
            }
        });
        
        const userEmailElement = document.getElementById('currentUserEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
        
        database.ref('students/' + currentUser.uid).once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    const studentDetails = snapshot.val();
                    updateStudentProfile(studentDetails);
                    updateStudentStats();
                }
            })
            .catch(error => {
                console.error('خطأ في تحميل بيانات الطالب:', error);
            });
    }
}

function updateStudentProfile(studentDetails) {
    const elements = {
        'profileStudentId': studentDetails.studentId || 'غير محدد',
        'profileBirthDate': studentDetails.birthDate || 'غير محدد',
        'profileDisability': studentDetails.disabilityType || 'غير محدد',
        'profileGradeLevel': studentDetails.gradeLevel || 'غير محدد'
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
    
    if (studentDetails.parentId) {
        database.ref('users/' + studentDetails.parentId).once('value')
            .then(parentSnapshot => {
                const parentElement = document.getElementById('profileParent');
                if (parentElement) {
                    parentElement.textContent = parentSnapshot.exists() ? 
                        parentSnapshot.val().fullName || 'غير محدد' : 'غير محدد';
                }
            })
            .catch(() => {
                const parentElement = document.getElementById('profileParent');
                if (parentElement) parentElement.textContent = 'غير محدد';
            });
    } else {
        const parentElement = document.getElementById('profileParent');
        if (parentElement) parentElement.textContent = 'غير محدد';
    }
}

function loadStudentGrades() {
    database.ref('grades').orderByChild('studentId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            const tbody = document.getElementById('studentGradesTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="6">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد نتائج حتى الآن</span>
                        </td>
                    </tr>
                `;
                updateGradesStats(0, 0);
                return;
            }
            
            const rows = [];
            let index = 1;
            let totalScore = 0;
            let totalGrades = 0;
            
            snapshot.forEach((childSnapshot) => {
                const grade = childSnapshot.val();
                
                let gradeLetter = 'غير محدد';
                if (grade.gradeScore >= 90) gradeLetter = 'ممتاز';
                else if (grade.gradeScore >= 80) gradeLetter = 'جيد جداً';
                else if (grade.gradeScore >= 70) gradeLetter = 'جيد';
                else if (grade.gradeScore >= 60) gradeLetter = 'مقبول';
                else gradeLetter = 'راسب';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index}</td>
                    <td>${grade.subject || 'غير محدد'}</td>
                    <td>${grade.gradeScore || 0}</td>
                    <td><span class="grade-badge ${gradeLetter}">${gradeLetter}</span></td>
                    <td>${grade.gradeDate || 'غير محدد'}</td>
                    <td>${grade.gradeNotes || 'لا توجد ملاحظات'}</td>
                `;
                
                rows.push(row);
                
                if (grade.gradeScore) {
                    totalScore += grade.gradeScore;
                    totalGrades++;
                }
                
                index++;
            });
            
            rows.forEach(row => tbody.appendChild(row));
            updateGradesStats(totalScore, totalGrades);
        })
        .catch((error) => {
            console.error('خطأ في تحميل الدرجات:', error);
            showToast('حدث خطأ في تحميل الدرجات', 'error');
        });
}

function updateStudentStats() {
    database.ref('grades').orderByChild('studentId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                let subjects = new Set();
                let totalScore = 0;
                let totalGrades = 0;
                
                snapshot.forEach((childSnapshot) => {
                    const grade = childSnapshot.val();
                    if (grade.subject) {
                        subjects.add(grade.subject);
                    }
                    if (grade.gradeScore) {
                        totalScore += grade.gradeScore;
                        totalGrades++;
                    }
                });
                
                const subjectsCountElement = document.getElementById('subjectsCount');
                if (subjectsCountElement) {
                    subjectsCountElement.textContent = subjects.size;
                }
                
                if (totalGrades > 0) {
                    const average = Math.round(totalScore / totalGrades);
                    const averageGradeElement = document.getElementById('averageGrade');
                    if (averageGradeElement) {
                        averageGradeElement.textContent = average + '%';
                    }
                }
            }
        })
        .catch((error) => {
            console.error('خطأ في حساب الإحصائيات:', error);
        });
}

function updateGradesStats(totalScore, totalGrades) {
    if (totalGrades > 0) {
        const average = Math.round(totalScore / totalGrades);
        const averageGradeElement = document.getElementById('averageGrade');
        const subjectsCountElement = document.getElementById('subjectsCount');
        
        if (averageGradeElement) {
            averageGradeElement.textContent = average + '%';
        }
        if (subjectsCountElement) {
            subjectsCountElement.textContent = totalGrades;
        }
    }
}

// ============================================
// 9. نظام إدارة ولي الأمر (parent.html) - محسن
// ============================================
function initParentDashboard() {
    checkAuth('parent').then(() => {
        loadParentData();
        setCurrentDate();
        hideLoading();
    }).catch(error => {
        console.error('خطأ في المصادقة:', error);
        window.location.href = 'index.html';
    });
}

function loadParentData() {
    if (currentUser && currentUserData) {
        const parentNameElements = document.querySelectorAll('#parentName, #parentWelcomeName');
        parentNameElements.forEach(element => {
            if (element) {
                element.textContent = currentUserData.fullName || 'ولي الأمر';
            }
        });
        
        const userEmailElement = document.getElementById('currentUserEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
        
        loadChildData();
    }
}

function loadChildData() {
    showLoading();
    
    database.ref('students').orderByChild('parentId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const childId = Object.keys(snapshot.val())[0];
                if (childId) {
                    getChildData(childId);
                } else {
                    showNoChildMessage();
                    hideLoading();
                }
            } else {
                showNoChildMessage();
                hideLoading();
            }
        })
        .catch(error => {
            console.error('خطأ في البحث عن الطفل:', error);
            showNoChildMessage();
            hideLoading();
        });
}

function getChildData(childId) {
    showLoading();
    
    Promise.all([
        database.ref('students/' + childId).once('value'),
        database.ref('users/' + currentUser.uid).once('value')
    ])
    .then(([childSnapshot, userSnapshot]) => {
        if (childSnapshot.exists()) {
            const childData = childSnapshot.val();
            displayChildInfo(childData);
            loadChildGrades(childId);
            loadChildMedicalFollowup(childId);
            
            // تحديث childId في بيانات ولي الأمر إذا لم يكن موجوداً
            const userData = userSnapshot.val();
            if (!userData.childId || userData.childId !== childId) {
                database.ref('users/' + currentUser.uid).update({
                    childId: childId
                });
            }
        } else {
            showNoChildMessage();
        }
        hideLoading();
    })
    .catch(error => {
        console.error('خطأ في جلب بيانات الطفل:', error);
        showNoChildMessage();
        hideLoading();
    });
}

function displayChildInfo(childData) {
    const childInfoCard = document.getElementById('childInfoCard');
    if (childInfoCard) {
        childInfoCard.innerHTML = `
            <div class="child-info-header">
                <div class="child-avatar">
                    <i class="fas fa-child"></i>
                </div>
                <div class="child-info">
                    <h3>${childData.fullName || 'غير محدد'}</h3>
                    <p>رقم الهوية: ${childData.studentId || 'غير محدد'}</p>
                </div>
            </div>
            
            <div class="child-details">
                <div class="detail-item">
                    <span class="detail-label">تاريخ الميلاد:</span>
                    <span class="detail-value">${childData.birthDate || 'غير محدد'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الصف الدراسي:</span>
                    <span class="detail-value">${childData.gradeLevel || 'غير محدد'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">نوع الإعاقة:</span>
                    <span class="detail-value">${childData.disabilityType || 'غير محدد'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المدرسة:</span>
                    <span class="detail-value">مدرسة الأمل</span>
                </div>
            </div>
            
            <div class="child-actions">
                <button class="btn btn-primary" onclick="showSection('child-profile')">
                    <i class="fas fa-child"></i> عرض الملف الشخصي الكامل
                </button>
            </div>
        `;
    }
    
    updateChildProfile(childData);
}

function updateChildProfile(childData) {
    const profileContent = document.getElementById('childProfileContent');
    if (profileContent) {
        profileContent.innerHTML = `
            <div class="child-profile-card">
                <div class="profile-section">
                    <h3><i class="fas fa-user"></i> المعلومات الشخصية</h3>
                    <div class="profile-grid">
                        <div class="profile-item">
                            <label>الاسم الكامل:</label>
                            <span>${childData.fullName || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>رقم الهوية:</label>
                            <span>${childData.studentId || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>تاريخ الميلاد:</label>
                            <span>${childData.birthDate || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>العمر:</label>
                            <span>${calculateAge(childData.birthDate) || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>نوع الإعاقة:</label>
                            <span>${childData.disabilityType || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>الصف الدراسي:</label>
                            <span>${childData.gradeLevel || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>البريد الإلكتروني:</label>
                            <span>${childData.email || 'غير محدد'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-section">
                    <h3><i class="fas fa-stethoscope"></i> المعلومات الطبية</h3>
                    <div class="profile-grid">
                        <div class="profile-item">
                            <label>تاريخ التشخيص:</label>
                            <span>${childData.diagnosisDate || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>الجهة الطبية:</label>
                            <span>${childData.medicalCenter || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>الطبيب المعالج:</label>
                            <span>${childData.doctorName || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item">
                            <label>رقم هاتف الطبيب:</label>
                            <span>${childData.doctorPhone || 'غير محدد'}</span>
                        </div>
                        <div class="profile-item full-width">
                            <label>الملاحظات الطبية:</label>
                            <p>${childData.medicalNotes || 'لا توجد ملاحظات طبية'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="profile-section">
                    <h3><i class="fas fa-school"></i> المعلومات الأكاديمية</h3>
                    <div class="profile-grid">
                        <div class="profile-item">
                            <label>المدرسة:</label>
                            <span>مدرسة الأمل</span>
                        </div>
                        <div class="profile-item">
                            <label>السنة الدراسية:</label>
                            <span>${childData.academicYear || '2023-2024'}</span>
                        </div>
                        <div class="profile-item">
                            <label>الفصل الدراسي:</label>
                            <span>${childData.semester || 'الأول'}</span>
                        </div>
                        <div class="profile-item full-width">
                            <label>ملاحظات أكاديمية:</label>
                            <p>${childData.notes || 'لا توجد ملاحظات'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

function calculateAge(birthDate) {
    if (!birthDate) return 'غير محدد';
    
    try {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return `${age} سنة`;
    } catch (error) {
        return 'غير محدد';
    }
}

function loadChildGrades(childId) {
    showLoading();
    
    database.ref('grades').orderByChild('studentId').equalTo(childId).once('value')
        .then(snapshot => {
            const container = document.getElementById('childGradesContainer');
            if (!container) {
                hideLoading();
                return;
            }
            
            if (!snapshot.exists()) {
                container.innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-chart-line"></i>
                        <h3>لا توجد نتائج دراسية حتى الآن</h3>
                        <p>سيتم إضافة النتائج الدراسية من قبل المعلمين قريباً</p>
                    </div>
                `;
                hideLoading();
                return;
            }
            
            let gradesHTML = `
                <div class="grades-summary">
                    <h3><i class="fas fa-chart-bar"></i> ملخص النتائج الدراسية</h3>
                    <div class="summary-cards" id="gradesSummary">
                        <!-- سيتم ملؤها بالجافاسكريبت -->
                    </div>
                </div>
                
                <div class="grades-table-section">
                    <h3><i class="fas fa-table"></i> تفاصيل الدرجات</h3>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>المادة</th>
                                    <th>نوع الاختبار</th>
                                    <th>التاريخ</th>
                                    <th>الدرجة</th>
                                    <th>التقدير</th>
                                    <th>ملاحظات المعلم</th>
                                </tr>
                            </thead>
                            <tbody id="childGradesTableBody">
                                <!-- سيتم ملؤها بالجافاسكريبت -->
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            container.innerHTML = gradesHTML;
            
            let totalScore = 0;
            let totalGrades = 0;
            let subjects = new Set();
            let subjectsData = {};
            
            const rows = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const grade = childSnapshot.val();
                
                let gradeLetter = 'غير محدد';
                if (grade.gradeScore >= 90) gradeLetter = 'ممتاز';
                else if (grade.gradeScore >= 80) gradeLetter = 'جيد جداً';
                else if (grade.gradeScore >= 70) gradeLetter = 'جيد';
                else if (grade.gradeScore >= 60) gradeLetter = 'مقبول';
                else gradeLetter = 'راسب';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index}</td>
                    <td>${grade.subject || 'غير محدد'}</td>
                    <td>${grade.gradeType || 'غير محدد'}</td>
                    <td>${grade.gradeDate || 'غير محدد'}</td>
                    <td>${grade.gradeScore || 0}</td>
                    <td><span class="grade-badge ${gradeLetter}">${gradeLetter}</span></td>
                    <td>${grade.gradeNotes || 'لا توجد ملاحظات'}</td>
                `;
                rows.push(row);
                
                if (grade.gradeScore) {
                    totalScore += grade.gradeScore;
                    totalGrades++;
                    
                    if (grade.subject) {
                        subjects.add(grade.subject);
                        if (!subjectsData[grade.subject]) {
                            subjectsData[grade.subject] = {
                                total: 0,
                                count: 0
                            };
                        }
                        subjectsData[grade.subject].total += grade.gradeScore;
                        subjectsData[grade.subject].count++;
                    }
                }
                
                index++;
            });
            
            const tbody = document.getElementById('childGradesTableBody');
            if (tbody) {
                rows.forEach(row => tbody.appendChild(row));
            }
            
            updateGradesSummary(totalScore, totalGrades, subjects.size, subjectsData);
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل درجات الطفل:', error);
            showToast('حدث خطأ في تحميل درجات الطفل', 'error');
            hideLoading();
        });
}

function updateGradesSummary(totalScore, totalGrades, subjectsCount, subjectsData) {
    const summaryDiv = document.getElementById('gradesSummary');
    if (!summaryDiv) return;
    
    let average = totalGrades > 0 ? Math.round(totalScore / totalGrades) : 0;
    
    summaryDiv.innerHTML = `
        <div class="summary-card">
            <div class="summary-icon" style="background: #4a6ee0;">
                <i class="fas fa-book"></i>
            </div>
            <div class="summary-info">
                <h4>عدد المواد</h4>
                <div class="summary-value">${subjectsCount}</div>
            </div>
        </div>
        
        <div class="summary-card">
            <div class="summary-icon" style="background: #6a11cb;">
                <i class="fas fa-chart-line"></i>
            </div>
            <div class="summary-info">
                <h4>المتوسط العام</h4>
                <div class="summary-value">${average}%</div>
            </div>
        </div>
        
        <div class="summary-card">
            <div class="summary-icon" style="background: #28a745;">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="summary-info">
                <h4>عدد الاختبارات</h4>
                <div class="summary-value">${totalGrades}</div>
            </div>
        </div>
        
        <div class="summary-card">
            <div class="summary-icon" style="background: #ffc107;">
                <i class="fas fa-star"></i>
            </div>
            <div class="summary-info">
                <h4>أفضل مادة</h4>
                <div class="summary-value">${getBestSubject(subjectsData)}</div>
            </div>
        </div>
    `;
}

function getBestSubject(subjectsData) {
    let bestSubject = 'غير محدد';
    let highestAverage = 0;
    
    for (const subject in subjectsData) {
        const average = subjectsData[subject].total / subjectsData[subject].count;
        if (average > highestAverage) {
            highestAverage = average;
            bestSubject = subject;
        }
    }
    
    return bestSubject;
}

function loadChildMedicalFollowup(childId) {
    showLoading();
    
    database.ref('medicalHistory').orderByChild('studentId').equalTo(childId).once('value')
        .then(snapshot => {
            const container = document.getElementById('follow-upContainer');
            if (!container) {
                hideLoading();
                return;
            }
            
            if (!snapshot.exists()) {
                container.innerHTML = `
                    <div class="no-data-message">
                        <i class="fas fa-heartbeat"></i>
                        <h3>لا توجد بيانات متابعة طبية</h3>
                        <p>سيتم إضافة بيانات المتابعة الطبية من قبل الأخصائيين قريباً</p>
                    </div>
                `;
                hideLoading();
                return;
            }
            
            let followupHTML = `
                <div class="followup-cards" id="medicalFollowupCards">
                    <!-- سيتم ملؤها بالجافاسكريبت -->
                </div>
            `;
            
            container.innerHTML = followupHTML;
            
            const cardsDiv = document.getElementById('medicalFollowupCards');
            const cards = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const record = childSnapshot.val();
                
                const card = document.createElement('div');
                card.className = 'followup-card';
                card.innerHTML = `
                    <div class="followup-header">
                        <span class="followup-date">${record.recordDate || 'غير محدد'}</span>
                        <span class="followup-type">${record.visitType || 'متابعة'}</span>
                    </div>
                    
                    <div class="followup-content">
                        <div class="followup-item">
                            <label><i class="fas fa-user-md"></i> الأخصائي:</label>
                            <span>${record.specialistName || 'غير محدد'}</span>
                        </div>
                        <div class="followup-item">
                            <label><i class="fas fa-stethoscope"></i> التشخيص:</label>
                            <span>${record.diagnosis || 'غير محدد'}</span>
                        </div>
                        <div class="followup-item">
                            <label><i class="fas fa-prescription-bottle-alt"></i> العلاج:</label>
                            <span>${record.treatment || 'غير محدد'}</span>
                        </div>
                        <div class="followup-item">
                            <label><i class="fas fa-calendar-check"></i> موعد المقبل:</label>
                            <span>${record.nextVisit || 'غير محدد'}</span>
                        </div>
                        <div class="followup-item full-width">
                            <label><i class="fas fa-comment-medical"></i> ملاحظات:</label>
                            <p>${record.notes || 'لا توجد ملاحظات'}</p>
                        </div>
                    </div>
                    
                    <div class="followup-actions">
                        <span class="followup-status ${record.status || 'مكتمل'}">${record.status || 'مكتمل'}</span>
                    </div>
                `;
                
                cards.push(card);
                index++;
            });
            
            cards.forEach(card => cardsDiv.appendChild(card));
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل المتابعة الطبية:', error);
            showToast('حدث خطأ في تحميل المتابعة الطبية', 'error');
            hideLoading();
        });
}

function showNoChildMessage() {
    const childInfoCard = document.getElementById('childInfoCard');
    if (childInfoCard) {
        childInfoCard.innerHTML = `
            <div class="no-child-message">
                <i class="fas fa-child"></i>
                <h3>لا يوجد طفل مرتبط بحسابك</h3>
                <p>يرجى التواصل مع المشرف لإضافة طفل إلى حسابك</p>
                <button class="btn btn-primary" onclick="contactAdmin()">
                    <i class="fas fa-headset"></i> التواصل مع المشرف
                </button>
            </div>
        `;
    }
}

function contactAdmin() {
    alert('يرجى التواصل مع المشرف العام على البريد: admin@school.edu أو الهاتف: 0591234567');
}

// ============================================
// 10. نظام إدارة المعلم (teacher.html) - محسن
// ============================================
function initTeacherDashboard() {
    checkAuth('teacher').then(() => {
        loadTeacherData();
        loadTeacherStudents();
        loadTeacherGradesList();
        initAddGradeForm();
        setCurrentDate();
        hideLoading();
        
        // تهيئة البحث
        setTimeout(() => {
            initSearch('my-students');
            initSearch('grades-list');
        }, 500);
    }).catch(error => {
        console.error('خطأ في المصادقة:', error);
        window.location.href = 'index.html';
    });
}

function loadTeacherData() {
    if (currentUser && currentUserData) {
        const teacherNameElements = document.querySelectorAll('#teacherName, #teacherWelcomeName');
        teacherNameElements.forEach(element => {
            if (element) {
                element.textContent = currentUserData.fullName || 'المعلم';
            }
        });
        
        const subjectElement = document.getElementById('teacherSubject');
        const currentSubjectElement = document.getElementById('currentSubject');
        if (subjectElement && currentUserData.subjectId) {
            loadSubjects().then(() => {
                const subjectName = getSubjectName(currentUserData.subjectId);
                subjectElement.textContent = subjectName;
                if (currentSubjectElement) {
                    currentSubjectElement.textContent = subjectName;
                }
            });
        }
        
        const userEmailElement = document.getElementById('currentUserEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
        
        updateTeacherStats();
    }
}

function loadTeacherStudents() {
    showLoading();
    
    // جلب جميع الطلاب الذين تم تعيين المعلم لهم
    database.ref('student_teachers').orderByChild('teacherId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            const tbody = document.getElementById('teacherStudentsTableBody');
            const gradeStudentSelect = document.getElementById('gradeStudent');
            
            if (!tbody && !gradeStudentSelect) {
                hideLoading();
                return;
            }
            
            if (!snapshot.exists()) {
                if (tbody) {
                    tbody.innerHTML = `
                        <tr class="no-data">
                            <td colspan="8">
                                <i class="fas fa-info-circle"></i>
                                <span>لا توجد طلاب معينين لك حتى الآن</span>
                            </td>
                        </tr>
                    `;
                }
                if (gradeStudentSelect) {
                    gradeStudentSelect.innerHTML = '<option value="">لا توجد طلاب</option>';
                }
                hideLoading();
                return;
            }
            
            const studentIds = [];
            snapshot.forEach(child => {
                const assignment = child.val();
                if (assignment.studentId) {
                    studentIds.push(assignment.studentId);
                }
            });
            
            // إزالة التكرارات
            const uniqueStudentIds = [...new Set(studentIds)];
            
            if (uniqueStudentIds.length === 0) {
                if (tbody) {
                    tbody.innerHTML = `
                        <tr class="no-data">
                            <td colspan="8">
                                <i class="fas fa-info-circle"></i>
                                <span>لا توجد طلاب معينين لك حتى الآن</span>
                            </td>
                        </tr>
                    `;
                }
                hideLoading();
                return;
            }
            
            // جلب بيانات جميع الطلاب دفعة واحدة
            const studentPromises = uniqueStudentIds.map(studentId => 
                database.ref('students/' + studentId).once('value')
            );
            
            Promise.all(studentPromises).then(studentSnapshots => {
                if (tbody) tbody.innerHTML = '';
                if (gradeStudentSelect) {
                    gradeStudentSelect.innerHTML = '<option value="">اختر الطالب</option>';
                }
                
                const rows = [];
                let studentsCount = 0;
                let totalAverage = 0;
                let totalStudentsWithGrades = 0;
                
                studentSnapshots.forEach((studentSnapshot, index) => {
                    if (!studentSnapshot.exists()) return;
                    
                    const student = studentSnapshot.val();
                    const studentId = uniqueStudentIds[index];
                    
                    studentsCount++;
                    
                    if (gradeStudentSelect) {
                        const option = document.createElement('option');
                        option.value = studentId;
                        option.textContent = student.fullName || 'طالب بدون اسم';
                        gradeStudentSelect.appendChild(option);
                    }
                    
                    // جلب درجات الطالب
                    database.ref('grades')
                        .orderByChild('studentId')
                        .equalTo(studentId)
                        .once('value')
                        .then(gradesSnapshot => {
                            let studentTotal = 0;
                            let studentGradesCount = 0;
                            let lastGrade = 0;
                            let attendance = 'حاضر';
                            
                            if (gradesSnapshot.exists()) {
                                gradesSnapshot.forEach(gradeSnapshot => {
                                    const grade = gradeSnapshot.val();
                                    if (grade.gradeScore) {
                                        studentTotal += grade.gradeScore;
                                        studentGradesCount++;
                                        lastGrade = grade.gradeScore;
                                    }
                                });
                            }
                            
                            const studentAverage = studentGradesCount > 0 ? Math.round(studentTotal / studentGradesCount) : 0;
                            
                            if (studentAverage > 0) {
                                totalAverage += studentAverage;
                                totalStudentsWithGrades++;
                            }
                            
                            if (tbody) {
                                const row = document.createElement('tr');
                                row.innerHTML = `
                                    <td>${studentsCount}</td>
                                    <td>${student.fullName || 'غير محدد'}</td>
                                    <td>${student.gradeLevel || 'غير محدد'}</td>
                                    <td>${lastGrade}</td>
                                    <td>${studentAverage}%</td>
                                    <td>${studentGradesCount}</td>
                                    <td><span class="attendance-badge ${attendance}">${attendance}</span></td>
                                    <td>
                                        <button type="button" class="btn-icon add-grade" onclick="addGradeForStudent('${studentId}', '${student.fullName || 'الطالب'}')">
                                            <i class="fas fa-plus"></i> إضافة درجة
                                        </button>
                                        <button type="button" class="btn-icon view-grades" onclick="viewStudentGrades('${studentId}')">
                                            <i class="fas fa-eye"></i> عرض الدرجات
                                        </button>
                                    </td>
                                `;
                                rows.push(row);
                            }
                            
                            // إذا كانت هذه هي آخر طالب، أضف الصفوف إلى الجدول
                            if (rows.length === studentSnapshots.length) {
                                rows.forEach(row => tbody.appendChild(row));
                                
                                const finalAverage = totalStudentsWithGrades > 0 ? Math.round(totalAverage / totalStudentsWithGrades) : 0;
                                const averageScoreElement = document.getElementById('averageScore');
                                const subjectStudentsCountElement = document.getElementById('subjectStudentsCount');
                                
                                if (averageScoreElement) averageScoreElement.textContent = finalAverage + '%';
                                if (subjectStudentsCountElement) subjectStudentsCountElement.textContent = studentsCount;
                                
                                hideLoading();
                            }
                        })
                        .catch(error => {
                            console.error('خطأ في جلب درجات الطالب:', error);
                        });
                });
            }).catch(error => {
                console.error('خطأ في جلب بيانات الطلاب:', error);
                hideLoading();
            });
        })
        .catch((error) => {
            console.error('خطأ في تحميل الطلاب:', error);
            showToast('حدث خطأ في تحميل قائمة الطلاب', 'error');
            hideLoading();
        });
}

function initAddGradeForm() {
    const addGradeForm = document.getElementById('addGradeForm');
    if (addGradeForm) {
        addGradeForm.addEventListener('submit', handleAddGrade);
        
        const today = new Date().toISOString().split('T')[0];
        const gradeDateInput = document.getElementById('gradeDate');
        if (gradeDateInput) {
            gradeDateInput.value = today;
        }
    }
}

function handleAddGrade(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('gradeStudent').value;
    const gradeType = document.getElementById('gradeType').value;
    const gradeDate = document.getElementById('gradeDate').value;
    const gradeScore = document.getElementById('gradeScore').value;
    const gradeNotes = document.getElementById('gradeNotes').value;
    
    if (!studentId || !gradeType || !gradeDate || !gradeScore) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (gradeScore < 0 || gradeScore > 100) {
        showToast('الدرجة يجب أن تكون بين 0 و 100', 'error');
        return;
    }
    
    showLoading();
    
    // التحقق من أن المعلم مسؤول عن هذا الطالب في مادته
    database.ref('student_teachers')
        .orderByChild('studentId')
        .equalTo(studentId)
        .once('value')
        .then(snapshot => {
            let canAssign = false;
            snapshot.forEach(child => {
                const assignment = child.val();
                if (assignment.teacherId === currentUser.uid && assignment.subjectId === currentUserData.subjectId) {
                    canAssign = true;
                }
            });
            
            if (!canAssign) {
                throw new Error('أنت لست مسؤولاً عن هذا الطالب في مادتك');
            }
            
            return database.ref('students/' + studentId).once('value');
        })
        .then(studentSnapshot => {
            if (!studentSnapshot.exists()) {
                throw new Error('الطالب غير موجود');
            }
            
            const student = studentSnapshot.val();
            const subject = getSubjectName(currentUserData.subjectId) || 'غير محدد';
            
            const gradeData = {
                studentId: studentId,
                studentName: student.fullName || 'غير محدد',
                teacherId: currentUser.uid,
                teacherName: currentUserData.fullName || 'المعلم',
                subject: subject,
                gradeType: gradeType,
                gradeDate: gradeDate,
                gradeScore: parseInt(gradeScore),
                gradeNotes: gradeNotes || 'لا توجد ملاحظات',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            return database.ref('grades').push().set(gradeData);
        })
        .then(() => {
            showToast('تم إضافة الدرجة بنجاح!', 'success');
            
            document.getElementById('addGradeForm').reset();
            
            loadTeacherGradesList();
            loadTeacherStudents();
            updateTeacherStats();
            
            hideLoading();
            
            showSection('grades-list');
        })
        .catch((error) => {
            console.error('خطأ في إضافة الدرجة:', error);
            showToast('حدث خطأ أثناء إضافة الدرجة: ' + error.message, 'error');
            hideLoading();
        });
}

function loadTeacherGradesList() {
    showLoading();
    
    database.ref('grades').orderByChild('teacherId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            const tbody = document.getElementById('gradesListTableBody');
            if (!tbody) {
                hideLoading();
                return;
            }
            
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="7">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد درجات حتى الآن</span>
                        </td>
                    </tr>
                `;
                hideLoading();
                return;
            }
            
            const rows = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const grade = childSnapshot.val();
                const gradeId = childSnapshot.key;
                
                let gradeLetter = 'غير محدد';
                if (grade.gradeScore >= 90) gradeLetter = 'ممتاز';
                else if (grade.gradeScore >= 80) gradeLetter = 'جيد جداً';
                else if (grade.gradeScore >= 70) gradeLetter = 'جيد';
                else if (grade.gradeScore >= 60) gradeLetter = 'مقبول';
                else gradeLetter = 'راسب';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="#">${index}</td>
                    <td data-label="اسم الطالب">${grade.studentName || 'غير محدد'}</td>
                    <td data-label="نوع الاختبار">${grade.gradeType || 'غير محدد'}</td>
                    <td data-label="التاريخ">
                        <div class="date-cell">
                            <span class="date-day">${formatDateDay(grade.gradeDate)}</span>
                            <span class="date-month">${formatDateMonth(grade.gradeDate)}</span>
                        </div>
                    </td>
                    <td data-label="الدرجة">
                        <div class="score-display">
                            <span class="score-value">${grade.gradeScore || 0}</span>
                            <span class="score-max">/100</span>
                        </div>
                    </td>
                    <td data-label="التقدير">
                        <span class="grade-badge ${gradeLetter}">${gradeLetter}</span>
                    </td>
                    <td data-label="الإجراءات">
                        <div class="action-buttons">
                            <button type="button" class="btn-icon view" onclick="viewGradeDetails('${gradeId}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn-icon edit" onclick="editGrade('${gradeId}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn-icon delete" onclick="confirmDeleteGrade('${gradeId}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                rows.push(row);
                index++;
            });
            
            rows.forEach(row => tbody.appendChild(row));
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل قائمة الدرجات:', error);
            showToast('حدث خطأ في تحميل قائمة الدرجات', 'error');
            hideLoading();
        });
}

function updateTeacherStats() {
    database.ref('grades').orderByChild('teacherId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                let totalScore = 0;
                let totalGrades = 0;
                let studentsSet = new Set();
                
                snapshot.forEach((childSnapshot) => {
                    const grade = childSnapshot.val();
                    
                    if (grade.gradeScore) {
                        totalScore += grade.gradeScore;
                        totalGrades++;
                    }
                    
                    if (grade.studentId) {
                        studentsSet.add(grade.studentId);
                    }
                });
                
                const average = totalGrades > 0 ? Math.round(totalScore / totalGrades) : 0;
                const averageScoreElement = document.getElementById('averageScore');
                const subjectStudentsCountElement = document.getElementById('subjectStudentsCount');
                
                if (averageScoreElement) averageScoreElement.textContent = average + '%';
                if (subjectStudentsCountElement) subjectStudentsCountElement.textContent = studentsSet.size;
            }
        })
        .catch((error) => {
            console.error('خطأ في تحديث إحصائيات المعلم:', error);
        });
}

function addGradeForStudent(studentId, studentName) {
    showSection('add-grade');
    
    const gradeStudentSelect = document.getElementById('gradeStudent');
    if (gradeStudentSelect) {
        gradeStudentSelect.value = studentId;
        
        let found = false;
        for (let option of gradeStudentSelect.options) {
            if (option.value === studentId) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            const option = document.createElement('option');
            option.value = studentId;
            option.textContent = studentName;
            gradeStudentSelect.appendChild(option);
        }
        
        gradeStudentSelect.value = studentId;
    }
}

function viewStudentGrades(studentId) {
    showLoading();
    
    database.ref('grades')
        .orderByChild('studentId')
        .equalTo(studentId)
        .once('value')
        .then(snapshot => {
            hideLoading();
            
            if (!snapshot.exists()) {
                alert('لا توجد درجات لهذا الطالب');
                return;
            }
            
            let message = 'درجات الطالب:\n\n';
            let total = 0;
            let count = 0;
            
            snapshot.forEach(childSnapshot => {
                const grade = childSnapshot.val();
                message += `- ${grade.subject || 'مادة'}: ${grade.gradeScore} (${grade.gradeType || 'نوع'})\n`;
                
                if (grade.gradeScore) {
                    total += grade.gradeScore;
                    count++;
                }
            });
            
            if (count > 0) {
                const average = Math.round(total / count);
                message += `\nالمتوسط: ${average}%`;
            }
            
            alert(message);
        })
        .catch(error => {
            hideLoading();
            console.error('خطأ في عرض درجات الطالب:', error);
            alert('حدث خطأ في جلب درجات الطالب');
        });
}

function viewGradeDetails(gradeId) {
    database.ref('grades/' + gradeId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                alert('الدرجة غير موجودة');
                return;
            }
            
            const grade = snapshot.val();
            let message = `📋 **تفاصيل الدرجة**\n\n`;
            message += `👦 الطالب: ${grade.studentName || 'غير محدد'}\n`;
            message += `👨‍🏫 المعلم: ${grade.teacherName || 'غير محدد'}\n`;
            message += `📚 المادة: ${grade.subject || 'غير محدد'}\n`;
            message += `📊 نوع الاختبار: ${grade.gradeType || 'غير محدد'}\n`;
            message += `📅 التاريخ: ${grade.gradeDate || 'غير محدد'}\n`;
            message += `⭐ الدرجة: ${grade.gradeScore || 0}/100\n\n`;
            message += `📝 **الملاحظات:**\n${grade.gradeNotes || 'لا توجد ملاحظات'}`;
            
            alert(message);
        })
        .catch(error => {
            console.error('خطأ في عرض تفاصيل الدرجة:', error);
            alert('حدث خطأ في عرض تفاصيل الدرجة');
        });
}

function confirmDeleteGrade(gradeId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذه الدرجة؟\n\nهذا الإجراء لا يمكن التراجع عنه.')) {
        showLoading();
        
        database.ref('grades/' + gradeId).remove()
            .then(() => {
                showToast('تم حذف الدرجة بنجاح', 'success');
                loadTeacherGradesList();
                updateTeacherStats();
                hideLoading();
            })
            .catch(error => {
                console.error('خطأ في حذف الدرجة:', error);
                showToast('حدث خطأ أثناء حذف الدرجة', 'error');
                hideLoading();
            });
    }
}

// ============================================
// 11. نظام إدارة الأخصائي (specialist.html) - محسن
// ============================================
function initSpecialistDashboard() {
    checkAuth('specialist').then(() => {
        loadSpecialistData();
        loadSpecialistChildren();
        loadEvaluationsList();
        loadMedicalHistory();
        initAddEvaluationForm();
        setCurrentDate();
        updateSpecialistStats();
        hideLoading();
        
        // تهيئة البحث
        setTimeout(() => {
            initSearch('children');
            initSearch('evaluations');
            initSearch('medical-history');
        }, 500);
    }).catch(error => {
        console.error('خطأ في المصادقة:', error);
        window.location.href = 'index.html';
    });
}

function loadSpecialistData() {
    if (currentUser && currentUserData) {
        const specialistNameElements = document.querySelectorAll('#specialistName, #specialistWelcomeName');
        specialistNameElements.forEach(element => {
            if (element) {
                element.textContent = currentUserData.fullName || 'الأخصائي';
            }
        });
        
        const userEmailElement = document.getElementById('currentUserEmail');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email;
        }
        
        if (currentUserData.specialty) {
            const specialtyBadge = document.createElement('span');
            specialtyBadge.className = 'specialty-badge';
            specialtyBadge.textContent = currentUserData.specialty;
            
            const userInfo = document.querySelector('.user-info');
            if (userInfo) {
                userInfo.appendChild(specialtyBadge);
            }
        }
    }
}

function loadSpecialistChildren() {
    showLoading();
    
    database.ref('students').once('value')
        .then(snapshot => {
            const tbody = document.getElementById('specialistChildrenTableBody');
            const evalStudentSelect = document.getElementById('evalStudent');
            
            if (!tbody && !evalStudentSelect) {
                hideLoading();
                return;
            }
            
            if (!snapshot.exists()) {
                if (tbody) {
                    tbody.innerHTML = `
                        <tr class="no-data">
                            <td colspan="7">
                                <i class="fas fa-info-circle"></i>
                                <span>لا توجد بيانات أطفال حتى الآن</span>
                            </td>
                        </tr>
                    `;
                }
                if (evalStudentSelect) {
                    evalStudentSelect.innerHTML = '<option value="">لا توجد أطفال</option>';
                }
                hideLoading();
                return;
            }
            
            if (tbody) tbody.innerHTML = '';
            if (evalStudentSelect) {
                evalStudentSelect.innerHTML = '<option value="">اختر الطفل</option>';
            }
            
            const rows = [];
            let childrenCount = 0;
            const childIds = [];
            
            snapshot.forEach((childSnapshot) => {
                const child = childSnapshot.val();
                const childId = childSnapshot.key;
                
                childrenCount++;
                childIds.push(childId);
                
                if (evalStudentSelect) {
                    const option = document.createElement('option');
                    option.value = childId;
                    option.textContent = child.fullName || 'طفل بدون اسم';
                    evalStudentSelect.appendChild(option);
                }
            });
            
            // جلب آخر تقييم لكل طالب
            const evaluationPromises = childIds.map(childId => 
                database.ref('evaluations')
                    .orderByChild('studentId')
                    .equalTo(childId)
                    .limitToLast(1)
                    .once('value')
            );
            
            Promise.all(evaluationPromises).then(evaluationSnapshots => {
                childIds.forEach((childId, index) => {
                    const childSnapshot = snapshot.child(childId);
                    if (!childSnapshot.exists()) return;
                    
                    const child = childSnapshot.val();
                    const evaluationSnapshot = evaluationSnapshots[index];
                    
                    let lastEvaluation = 'لا يوجد';
                    let lastEvaluationDate = 'غير محدد';
                    let progressLevel = 'غير محدد';
                    
                    if (evaluationSnapshot.exists()) {
                        evaluationSnapshot.forEach(evalChild => {
                            const evaluation = evalChild.val();
                            lastEvaluation = evaluation.evalType || 'غير محدد';
                            lastEvaluationDate = evaluation.evalDate || 'غير محدد';
                            
                            if (evaluation.evalScore >= 90) progressLevel = 'ممتاز';
                            else if (evaluation.evalScore >= 80) progressLevel = 'جيد جداً';
                            else if (evaluation.evalScore >= 70) progressLevel = 'جيد';
                            else if (evaluation.evalScore >= 60) progressLevel = 'مقبول';
                            else if (evaluation.evalScore > 0) progressLevel = 'يحتاج تحسين';
                        });
                    }
                    
                    const age = calculateAge(child.birthDate);
                    
                    if (tbody) {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-label="#">${index + 1}</td>
                            <td data-label="الاسم الكامل">
                                <div class="child-cell">
                                    <div class="child-name">${child.fullName || 'غير محدد'}</div>
                                    <div class="child-age">العمر: ${age}</div>
                                </div>
                            </td>
                            <td data-label="العمر">${age}</td>
                            <td data-label="نوع الإعاقة">${child.disabilityType || 'غير محدد'}</td>
                            <td data-label="آخر تقييم">
                                <div class="last-eval">
                                    <span class="eval-type">${lastEvaluation}</span>
                                    <span class="eval-date">${lastEvaluationDate}</span>
                                </div>
                            </td>
                            <td data-label="مستوى التقدم">
                                <span class="progress-level ${progressLevel}">${progressLevel}</span>
                            </td>
                            <td data-label="الإجراءات">
                                <button type="button" class="btn-icon add-eval" onclick="addEvaluationForChild('${childId}', '${child.fullName || 'الطفل'}')">
                                    <i class="fas fa-clipboard-check"></i> تقييم
                                </button>
                                <button type="button" class="btn-icon view-history" onclick="viewChildHistory('${childId}')">
                                    <i class="fas fa-history"></i> سجل
                                </button>
                            </td>
                        `;
                        rows.push(row);
                    }
                });
                
                if (tbody) {
                    rows.forEach(row => tbody.appendChild(row));
                }
                
                const childrenCountElement = document.getElementById('childrenCount');
                if (childrenCountElement) {
                    childrenCountElement.textContent = childrenCount;
                }
                
                hideLoading();
            }).catch(error => {
                console.error('خطأ في جلب تقييمات الأطفال:', error);
                hideLoading();
            });
        })
        .catch((error) => {
            console.error('خطأ في تحميل الأطفال:', error);
            showToast('حدث خطأ في تحميل قائمة الأطفال', 'error');
            hideLoading();
        });
}

function initAddEvaluationForm() {
    const addEvaluationForm = document.getElementById('addEvaluationForm');
    if (addEvaluationForm) {
        addEvaluationForm.addEventListener('submit', handleAddEvaluation);
        
        const today = new Date().toISOString().split('T')[0];
        const evalDateInput = document.getElementById('evalDate');
        if (evalDateInput) {
            evalDateInput.value = today;
        }
    }
}

function handleAddEvaluation(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('evalStudent').value;
    const evalType = document.getElementById('evalType').value;
    const evalDate = document.getElementById('evalDate').value;
    const evalScore = document.getElementById('evalScore').value;
    const evalNotes = document.getElementById('evalNotes').value;
    
    if (!studentId || !evalType || !evalDate || !evalScore) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (evalScore < 0 || evalScore > 100) {
        showToast('الدرجة يجب أن تكون بين 0 و 100', 'error');
        return;
    }
    
    showLoading();
    
    database.ref('students/' + studentId).once('value')
        .then(studentSnapshot => {
            if (!studentSnapshot.exists()) {
                throw new Error('الطفل غير موجود');
            }
            
            const student = studentSnapshot.val();
            
            const evaluationData = {
                studentId: studentId,
                studentName: student.fullName || 'غير محدد',
                specialistId: currentUser.uid,
                specialistName: currentUserData.fullName || 'الأخصائي',
                evalType: evalType,
                evalDate: evalDate,
                evalScore: parseInt(evalScore),
                evalNotes: evalNotes || 'لا توجد ملاحظات',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            return database.ref('evaluations').push().set(evaluationData);
        })
        .then(() => {
            showToast('تم إضافة التقييم بنجاح!', 'success');
            
            document.getElementById('addEvaluationForm').reset();
            
            loadEvaluationsList();
            loadSpecialistChildren();
            updateSpecialistStats();
            
            hideLoading();
            
            showSection('evaluations');
        })
        .catch((error) => {
            console.error('خطأ في إضافة التقييم:', error);
            showToast('حدث خطأ أثناء إضافة التقييم: ' + error.message, 'error');
            hideLoading();
        });
}

function loadEvaluationsList() {
    showLoading();
    
    database.ref('evaluations').orderByChild('specialistId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            const tbody = document.getElementById('evaluationsTableBody');
            if (!tbody) {
                hideLoading();
                return;
            }
            
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="6">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد تقييمات حتى الآن</span>
                        </td>
                    </tr>
                `;
                hideLoading();
                return;
            }
            
            const rows = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const evaluation = childSnapshot.val();
                const evalId = childSnapshot.key;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index}</td>
                    <td>${evaluation.studentName || 'غير محدد'}</td>
                    <td>${evaluation.evalType || 'غير محدد'}</td>
                    <td>${evaluation.evalDate || 'غير محدد'}</td>
                    <td>
                        <div class="score-display">
                            <span class="score-value">${evaluation.evalScore || 0}</span>
                            <span class="score-max">/100</span>
                        </div>
                    </td>
                    <td>
                        <button type="button" class="btn-icon view" onclick="viewEvaluationDetails('${evalId}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn-icon edit" onclick="editEvaluation('${evalId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-icon delete" onclick="confirmDeleteEvaluation('${evalId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                rows.push(row);
                index++;
            });
            
            rows.forEach(row => tbody.appendChild(row));
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل قائمة التقييمات:', error);
            showToast('حدث خطأ في تحميل قائمة التقييمات', 'error');
            hideLoading();
        });
}

function loadMedicalHistory() {
    showLoading();
    
    database.ref('medicalHistory').orderByChild('specialistId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            const tbody = document.getElementById('medicalHistoryTableBody');
            if (!tbody) {
                hideLoading();
                return;
            }
            
            tbody.innerHTML = '';
            
            if (!snapshot.exists()) {
                tbody.innerHTML = `
                    <tr class="no-data">
                        <td colspan="6">
                            <i class="fas fa-info-circle"></i>
                            <span>لا توجد بيانات طبية حتى الآن</span>
                        </td>
                    </tr>
                `;
                hideLoading();
                return;
            }
            
            const rows = [];
            let index = 1;
            
            snapshot.forEach((childSnapshot) => {
                const record = childSnapshot.val();
                const recordId = childSnapshot.key;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index}</td>
                    <td>${record.studentName || 'غير محدد'}</td>
                    <td>${record.diagnosis || 'غير محدد'}</td>
                    <td>${record.recordDate || 'غير محدد'}</td>
                    <td>${record.treatment || 'غير محدد'}</td>
                    <td>
                        <button type="button" class="btn-icon view" onclick="viewMedicalRecord('${recordId}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn-icon edit" onclick="editMedicalRecord('${recordId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                `;
                
                rows.push(row);
                index++;
            });
            
            rows.forEach(row => tbody.appendChild(row));
            hideLoading();
        })
        .catch((error) => {
            console.error('خطأ في تحميل السجلات الطبية:', error);
            showToast('حدث خطأ في تحميل السجلات الطبية', 'error');
            hideLoading();
        });
}

function updateSpecialistStats() {
    database.ref('students').once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const childrenCountElement = document.getElementById('childrenCount');
                if (childrenCountElement) {
                    childrenCountElement.textContent = snapshot.numChildren();
                }
            }
        })
        .catch(error => {
            console.error('خطأ في حساب عدد الأطفال:', error);
        });
    
    const upcomingSessionsElement = document.getElementById('upcomingSessions');
    if (upcomingSessionsElement) {
        upcomingSessionsElement.textContent = '3';
    }
}

function addEvaluationForChild(childId, childName) {
    showSection('add-evaluation');
    
    const evalStudentSelect = document.getElementById('evalStudent');
    if (evalStudentSelect) {
        evalStudentSelect.value = childId;
        
        let found = false;
        for (let option of evalStudentSelect.options) {
            if (option.value === childId) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            const option = document.createElement('option');
            option.value = childId;
            option.textContent = childName;
            evalStudentSelect.appendChild(option);
        }
        
        evalStudentSelect.value = childId;
    }
}

function viewChildHistory(childId) {
    showLoading();
    
    Promise.all([
        database.ref('evaluations').orderByChild('studentId').equalTo(childId).once('value'),
        database.ref('medicalHistory').orderByChild('studentId').equalTo(childId).once('value'),
        database.ref('students/' + childId).once('value')
    ])
    .then(([evaluationsSnapshot, medicalSnapshot, studentSnapshot]) => {
        hideLoading();
        
        if (!studentSnapshot.exists()) {
            alert('الطفل غير موجود');
            return;
        }
        
        const child = studentSnapshot.val();
        let message = `👦 **السجل الكامل للطفل:** ${child.fullName || 'غير محدد'}\n\n`;
        
        if (evaluationsSnapshot.exists()) {
            message += "📊 **التقييمات:**\n";
            evaluationsSnapshot.forEach(evalChild => {
                const evaluation = evalChild.val();
                message += `- ${evaluation.evalType}: ${evaluation.evalScore}/100 (${evaluation.evalDate})\n`;
            });
            message += "\n";
        } else {
            message += "📊 **التقييمات:** لا توجد\n\n";
        }
        
        if (medicalSnapshot.exists()) {
            message += "🏥 **السجلات الطبية:**\n";
            medicalSnapshot.forEach(recordChild => {
                const record = recordChild.val();
                message += `- ${record.diagnosis} (${record.recordDate})\n`;
            });
        } else {
            message += "🏥 **السجلات الطبية:** لا توجد";
        }
        
        alert(message);
    })
    .catch(error => {
        hideLoading();
        console.error('خطأ في جلب تاريخ الطفل:', error);
        alert('حدث خطأ في جلب تاريخ الطفل');
    });
}

function viewEvaluationDetails(evalId) {
    database.ref('evaluations/' + evalId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                alert('التقييم غير موجود');
                return;
            }
            
            const evaluation = snapshot.val();
            let message = `📋 **تفاصيل التقييم**\n\n`;
            message += `👦 الطفل: ${evaluation.studentName || 'غير محدد'}\n`;
            message += `👨‍⚕️ الأخصائي: ${evaluation.specialistName || 'غير محدد'}\n`;
            message += `📊 نوع التقييم: ${evaluation.evalType || 'غير محدد'}\n`;
            message += `📅 التاريخ: ${evaluation.evalDate || 'غير محدد'}\n`;
            message += `⭐ الدرجة: ${evaluation.evalScore || 0}/100\n\n`;
            message += `📝 **الملاحظات:**\n${evaluation.evalNotes || 'لا توجد ملاحظات'}`;
            
            alert(message);
        })
        .catch(error => {
            console.error('خطأ في عرض تفاصيل التقييم:', error);
            alert('حدث خطأ في عرض تفاصيل التقييم');
        });
}

function editEvaluation(evalId) {
    showLoading();
    
    database.ref('evaluations/' + evalId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                showToast('التقييم غير موجود', 'error');
                hideLoading();
                return;
            }
            
            const evaluation = snapshot.val();
            
            const modalHtml = `
                <div id="editEvaluationModal" class="modal-overlay active">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3><i class="fas fa-edit"></i> تعديل التقييم</h3>
                            <button class="modal-close" onclick="closeModal('editEvaluationModal')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="editEvaluationForm" class="form-container">
                                <input type="hidden" id="editEvaluationId" value="${evalId}">
                                
                                <div class="form-group">
                                    <label>الطفل</label>
                                    <input type="text" value="${evaluation.studentName || 'غير محدد'}" disabled>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editEvalType">نوع التقييم *</label>
                                        <select id="editEvalType" required>
                                            <option value="سمعي" ${evaluation.evalType === 'سمعي' ? 'selected' : ''}>سمعي</option>
                                            <option value="نطقي" ${evaluation.evalType === 'نطقي' ? 'selected' : ''}>نطقي</option>
                                            <option value="لغوي" ${evaluation.evalType === 'لغوي' ? 'selected' : ''}>لغوي</option>
                                            <option value="سلوكي" ${evaluation.evalType === 'سلوكي' ? 'selected' : ''}>سلوكي</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="editEvalDate">تاريخ التقييم *</label>
                                        <input type="date" id="editEvalDate" value="${evaluation.evalDate || ''}" required>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editEvalScore">الدرجة (من 100) *</label>
                                    <input type="number" id="editEvalScore" min="0" max="100" value="${evaluation.evalScore || 0}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editEvalNotes">ملاحظات التقييم</label>
                                    <textarea id="editEvalNotes" rows="3">${evaluation.evalNotes || ''}</textarea>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="closeModal('editEvaluationModal')">إلغاء</button>
                                    <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('editEvaluationForm').addEventListener('submit', function(e) {
                e.preventDefault();
                updateEvaluation(evalId);
            });
            
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تحميل التقييم:', error);
            showToast('حدث خطأ في تحميل التقييم', 'error');
            hideLoading();
        });
}

function updateEvaluation(evalId) {
    const evalData = {
        evalType: document.getElementById('editEvalType').value,
        evalDate: document.getElementById('editEvalDate').value,
        evalScore: parseInt(document.getElementById('editEvalScore').value),
        evalNotes: document.getElementById('editEvalNotes').value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    
    if (!evalData.evalType || !evalData.evalDate || evalData.evalScore === undefined) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (evalData.evalScore < 0 || evalData.evalScore > 100) {
        showToast('الدرجة يجب أن تكون بين 0 و 100', 'error');
        return;
    }
    
    showLoading();
    
    database.ref('evaluations/' + evalId).update(evalData)
        .then(() => {
            showToast('تم تحديث التقييم بنجاح', 'success');
            closeModal('editEvaluationModal');
            loadEvaluationsList();
            loadSpecialistChildren();
            updateSpecialistStats();
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تحديث التقييم:', error);
            showToast('حدث خطأ أثناء تحديث التقييم', 'error');
            hideLoading();
        });
}

function confirmDeleteEvaluation(evalId) {
    if (confirm('⚠️ هل أنت متأكد من حذف هذا التقييم؟\n\nهذا الإجراء لا يمكن التراجع عنه.')) {
        showLoading();
        
        database.ref('evaluations/' + evalId).remove()
            .then(() => {
                showToast('تم حذف التقييم بنجاح', 'success');
                loadEvaluationsList();
                loadSpecialistChildren();
                updateSpecialistStats();
                hideLoading();
            })
            .catch(error => {
                console.error('خطأ في حذف التقييم:', error);
                showToast('حدث خطأ أثناء حذف التقييم', 'error');
                hideLoading();
            });
    }
}

function viewMedicalRecord(recordId) {
    database.ref('medicalHistory/' + recordId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                alert('السجل الطبي غير موجود');
                return;
            }
            
            const record = snapshot.val();
            let message = `🏥 **السجل الطبي**\n\n`;
            message += `👦 الطفل: ${record.studentName || 'غير محدد'}\n`;
            message += `👨‍⚕️ الأخصائي: ${record.specialistName || 'غير محدد'}\n`;
            message += `📅 تاريخ الزيارة: ${record.recordDate || 'غير محدد'}\n`;
            message += `🔍 نوع الزيارة: ${record.visitType || 'غير محدد'}\n`;
            message += `🏥 التشخيص: ${record.diagnosis || 'غير محدد'}\n`;
            message += `💊 العلاج: ${record.treatment || 'غير محدد'}\n`;
            message += `📅 الموعد القادم: ${record.nextVisit || 'غير محدد'}\n`;
            message += `📈 الحالة: ${record.status || 'غير محدد'}\n\n`;
            message += `📝 **الملاحظات:**\n${record.notes || 'لا توجد ملاحظات'}`;
            
            alert(message);
        })
        .catch(error => {
            console.error('خطأ في عرض السجل الطبي:', error);
            alert('حدث خطأ في عرض السجل الطبي');
        });
}

function editMedicalRecord(recordId) {
    showLoading();
    
    database.ref('medicalHistory/' + recordId).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                showToast('السجل الطبي غير موجود', 'error');
                hideLoading();
                return;
            }
            
            const record = snapshot.val();
            
            const modalHtml = `
                <div id="editMedicalRecordModal" class="modal-overlay active">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3><i class="fas fa-edit"></i> تعديل السجل الطبي</h3>
                            <button class="modal-close" onclick="closeModal('editMedicalRecordModal')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="editMedicalRecordForm" class="form-container">
                                <input type="hidden" id="editMedicalRecordId" value="${recordId}">
                                
                                <div class="form-group">
                                    <label>الطفل</label>
                                    <input type="text" value="${record.studentName || 'غير محدد'}" disabled>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editRecordDate">تاريخ الزيارة *</label>
                                        <input type="date" id="editRecordDate" value="${record.recordDate || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="editVisitType">نوع الزيارة *</label>
                                        <select id="editVisitType" required>
                                            <option value="متابعة" ${record.visitType === 'متابعة' ? 'selected' : ''}>متابعة</option>
                                            <option value="تشخيص" ${record.visitType === 'تشخيص' ? 'selected' : ''}>تشخيص</option>
                                            <option value="طوارئ" ${record.visitType === 'طوارئ' ? 'selected' : ''}>طوارئ</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editDiagnosis">التشخيص *</label>
                                    <input type="text" id="editDiagnosis" value="${record.diagnosis || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editTreatment">العلاج</label>
                                    <textarea id="editTreatment" rows="2">${record.treatment || ''}</textarea>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="editNextVisit">الموعد القادم</label>
                                        <input type="date" id="editNextVisit" value="${record.nextVisit || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label for="editRecordStatus">الحالة</label>
                                        <select id="editRecordStatus">
                                            <option value="مكتمل" ${record.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                            <option value="مؤجل" ${record.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                                            <option value="ملغي" ${record.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="editRecordNotes">ملاحظات</label>
                                    <textarea id="editRecordNotes" rows="3">${record.notes || ''}</textarea>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="button" class="btn btn-secondary" onclick="closeModal('editMedicalRecordModal')">إلغاء</button>
                                    <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('editMedicalRecordForm').addEventListener('submit', function(e) {
                e.preventDefault();
                updateMedicalRecord(recordId);
            });
            
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تحميل السجل الطبي:', error);
            showToast('حدث خطأ في تحميل السجل الطبي', 'error');
            hideLoading();
        });
}

function updateMedicalRecord(recordId) {
    const recordData = {
        recordDate: document.getElementById('editRecordDate').value,
        visitType: document.getElementById('editVisitType').value,
        diagnosis: document.getElementById('editDiagnosis').value.trim(),
        treatment: document.getElementById('editTreatment').value.trim() || '',
        nextVisit: document.getElementById('editNextVisit').value || '',
        status: document.getElementById('editRecordStatus').value,
        notes: document.getElementById('editRecordNotes').value.trim() || '',
        updatedAt: new Date().toISOString()
    };
    
    if (!recordData.recordDate || !recordData.visitType || !recordData.diagnosis) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    showLoading();
    
    database.ref('medicalHistory/' + recordId).update(recordData)
        .then(() => {
            showToast('تم تحديث السجل الطبي بنجاح', 'success');
            closeModal('editMedicalRecordModal');
            loadMedicalHistory();
            hideLoading();
        })
        .catch(error => {
            console.error('خطأ في تحديث السجل الطبي:', error);
            showToast('حدث خطأ أثناء تحديث السجل الطبي', 'error');
            hideLoading();
        });
}

// ============================================
// 12. نظام المصادقة والصلاحيات - محسن
// ============================================
function checkAuth(requiredRole) {
    return new Promise((resolve, reject) => {
        showLoading();
        
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                
                firebase.database().ref('users/' + user.uid).once('value')
                    .then((snapshot) => {
                        if (snapshot.exists()) {
                            currentUserData = snapshot.val();
                            
                            if (currentUserData.role === requiredRole) {
                                resolve();
                            } else {
                                reject('ليس لديك صلاحية الدخول إلى هذه الصفحة');
                                window.location.href = 'index.html';
                            }
                        } else {
                            reject('بيانات المستخدم غير موجودة');
                            window.location.href = 'index.html';
                        }
                        hideLoading();
                    })
                    .catch((error) => {
                        reject(error);
                        hideLoading();
                        window.location.href = 'index.html';
                    });
            } else {
                reject('لم يتم تسجيل الدخول');
                hideLoading();
                window.location.href = 'index.html';
            }
        });
    });
}

// ============================================
// 13. تسجيل الخروج - محسن
// ============================================
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        showLoading();
        
        firebase.auth().signOut()
            .then(() => {
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('خطأ في تسجيل الخروج:', error);
                hideLoading();
                showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
            });
    }
}

// ============================================
// 14. تهيئة التصميم والتنسيقات - محسن
// ============================================
function initLayout() {
    adjustContentHeight();
    window.addEventListener('resize', adjustContentHeight);
    initSidebarButtons();
    setCurrentDate();
}

function adjustContentHeight() {
    const topBar = document.querySelector('.top-bar');
    const contentSections = document.querySelector('.content-sections');
    
    if (topBar && contentSections) {
        const topBarHeight = topBar.offsetHeight;
        const windowHeight = window.innerHeight;
        const newHeight = windowHeight - topBarHeight - 60;
        contentSections.style.minHeight = `${newHeight}px`;
    }
}

function initSidebarButtons() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const mainContent = document.querySelector('.main-content');
                
                if (sidebar) {
                    sidebar.classList.add('collapsed');
                }
                if (mainContent) {
                    mainContent.classList.add('expanded');
                }
                
                const toggleBtn = document.querySelector('.sidebar-toggle');
                if (toggleBtn) {
                    const icon = toggleBtn.querySelector('i');
                    if (icon) {
                        icon.className = 'fas fa-bars';
                    }
                }
            }
        });
    });
}

// ============================================
// 15. تهيئة الصفحة عند التحميل
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();

    initLayout();

    switch(currentPage) {
        case 'index.html':
        case '':
            initLoginPage();
            break;
        case 'admin.html':
            initAdminDashboard();
            break;
        case 'student.html': 
            initStudentDashboard();
            break;
        case 'parent.html': 
            initParentDashboard();
            break;
        case 'teacher.html':  
            initTeacherDashboard();
            break;
        case 'specialist.html':  
            initSpecialistDashboard();
            break;
    }
    
    setCurrentDate();
});