/**
 * Credit Assessment Quiz Module
 * Global script module for JAM Engine credit assessment functionality
 */

(function(window) {
    'use strict';

    // Credit Assessment Module
    const CreditAssessment = {
        // Configuration
        currentStep: 1,
        totalSteps: 7,
        quizData: {},
        
        // Initialize the module
        init: function() {
            this.injectStyles();
            this.createModal();
            this.bindEvents();
        },

        // Inject CSS styles
        injectStyles: function() {
            const styles = `
                <style id="credit-assessment-styles">
                    /* Quiz Button Styles */
                    .nav-quiz-button-container {
                        margin: 0 auto;
                        text-align: center;
                        width: 100%;
                        max-width: 400px;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    .nav-credit-quiz-btn {
                        background-color: #09ccfc;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        font-weight: 600;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: center;
                        display: inline-block;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        margin: 0;
                        position: relative;
                        width: auto;
                    }

                    .nav-credit-quiz-btn:hover {
                        background-color: #08b6e2;
                        transform: translateY(-2px);
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                    }

                    .nav-quiz-modal {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.5);
                        z-index: 1000;
                        -webkit-overflow-scrolling: touch;
                        box-sizing: border-box;
                        align-items: center;
                        justify-content: center;
                    }

                    .nav-modal-content {
                        position: relative;
                        top: auto;
                        left: auto;
                        transform: none;
                        background: #fff;
                        padding: 1rem;
                        overflow-y: auto;
                        -webkit-overflow-scrolling: touch;
                        box-sizing: border-box;
                        width: 92%;
                        max-width: 800px;
                        height: 92vh;
                        border-radius: 8px;
                        margin: auto;
                    }

                    .nav-close-button {
                        position: fixed;
                        top: max(env(safe-area-inset-top), 0.75rem);
                        right: 0.75rem;
                        padding: 0.75rem;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #666;
                        transition: color 0.3s ease;
                        z-index: 1001;
                    }

                    .nav-close-button:hover {
                        color: #000;
                    }

                    .nav-quiz-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 1rem;
                        box-sizing: border-box;
                        width: 100%;
                        font-family: 'Poppins', sans-serif;
                    }

                    .nav-progress-container {
                        margin: 1rem 0 2rem;
                        padding: 0 1rem;
                    }

                    .nav-progress-bar {
                        height: 8px;
                        background: #f0f0f0;
                        border-radius: 4px;
                        overflow: hidden;
                        position: relative;
                    }

                    .nav-progress-bar::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        height: 100%;
                        width: 0%;
                        background: #008080;
                        transition: width 0.3s ease;
                    }

                    .nav-progress-text {
                        display: block;
                        text-align: center;
                        margin-top: 0.5rem;
                        font-size: 0.875rem;
                        color: #666;
                    }

                    .nav-question-title {
                        font-size: 1.5rem;
                        margin-bottom: 2rem;
                        text-align: center;
                        padding: 0 1rem;
                    }

                    .nav-options-grid {
                        display: grid;
                        gap: 1rem;
                        padding: 0;
                        margin-bottom: 2rem;
                        box-sizing: border-box;
                        width: 100%;
                    }

                    .nav-option-btn {
                        background: #fff;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        padding: 1rem;
                        width: 100%;
                        text-align: left;
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        transition: all 0.3s ease;
                        cursor: pointer;
                    }

                    .nav-option-btn:hover {
                        border-color: #008080;
                        background-color: #f7fafa;
                    }

                    .nav-option-btn.nav-active,
                    .nav-option-btn.selected {
                        border-color: #008080;
                        background-color: #e6f3f3;
                        position: relative;
                    }

                    .nav-option-btn.nav-active::after,
                    .nav-option-btn.selected::after {
                        content: '✓';
                        position: absolute;
                        top: 0.5rem;
                        right: 0.5rem;
                        color: #008080;
                        font-size: 1rem;
                        font-weight: bold;
                    }

                    .nav-option-icon {
                        font-size: 1.5rem;
                        min-width: 2rem;
                        text-align: center;
                    }

                    .nav-option-text {
                        font-size: 1rem;
                        flex: 1;
                    }

                    .nav-quiz-navigation {
                        display: flex;
                        justify-content: space-between;
                        padding: 1rem;
                        gap: 1rem;
                        margin-top: 1rem;
                    }

                    .nav-nav-btn {
                        padding: 0.75rem 1.5rem;
                        border-radius: 25px;
                        border: none;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        min-width: 100px;
                    }

                    #nav-prevBtn {
                        background-color: #f0f0f0;
                        color: #666;
                    }

                    #nav-nextBtn {
                        background-color: #008080;
                        color: white;
                    }

                    #nav-nextBtn:disabled {
                        background-color: #cccccc;
                        cursor: not-allowed;
                    }

                    .nav-contact-form {
                        max-width: 400px;
                        margin: 0 auto;
                        padding: 0 1rem;
                    }

                    .nav-form-group {
                        margin-bottom: 1.5rem;
                    }

                    .nav-form-input {
                        width: 100%;
                        padding: 1rem;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 1rem;
                        transition: border-color 0.3s ease;
                        box-sizing: border-box;
                    }

                    .nav-form-input:focus {
                        outline: none;
                        border-color: #008080;
                    }

                    .nav-registration-form {
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 1rem;
                    }

                    .nav-form-subtitle {
                        text-align: center;
                        color: #666;
                        margin-bottom: 1.5rem;
                    }

                    .nav-form-group label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                        color: #333;
                    }

                    .nav-password-hint {
                        display: block;
                        font-size: 0.8rem;
                        color: #666;
                        margin-top: 0.25rem;
                    }

                    .nav-checkbox-group {
                        display: flex;
                        align-items: center;
                    }

                    .nav-checkbox-group input {
                        margin-right: 0.5rem;
                    }

                    .nav-checkbox-group label {
                        margin-bottom: 0;
                        font-size: 0.9rem;
                    }

                    .nav-checkbox-group a {
                        color: #008080;
                        text-decoration: none;
                    }

                    .nav-checkbox-group a:hover {
                        text-decoration: underline;
                    }

                    /* Mobile responsiveness */
                    @media (max-width: 639px) {
                        .nav-modal-content {
                            padding: 1rem;
                            margin: 0;
                            width: 100%;
                            height: 100%;
                            border-radius: 0;
                        }

                        .nav-quiz-container {
                            padding: 0;
                        }

                        .nav-options-grid {
                            padding: 0;
                        }

                        .nav-question-title {
                            padding: 0;
                            font-size: 1.25rem;
                        }

                        .nav-quiz-navigation {
                            position: sticky;
                            bottom: 0;
                            background: #fff;
                            padding: 1rem;
                            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
                            margin: 0 -1rem;
                        }

                        .nav-nav-btn {
                            min-height: 44px;
                            flex: 1;
                            font-size: 0.938rem;
                        }

                        .nav-close-button {
                            top: 0.5rem;
                            right: 0.5rem;
                            width: 36px;
                            height: 36px;
                            font-size: 1.3rem;
                            background-color: rgba(255, 255, 255, 0.9);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                    }

                    @supports (-webkit-touch-callout: none) {
                        .nav-modal-content {
                            height: -webkit-fill-available;
                        }

                        .nav-quiz-navigation {
                            padding-bottom: max(env(safe-area-inset-bottom), 1rem);
                        }
                    }

                    @media (min-width: 640px) {
                        .nav-options-grid {
                            grid-template-columns: repeat(2, 1fr);
                        }

                        .nav-question-title {
                            font-size: 1.75rem;
                        }
                    }
                </style>
            `;

            // Remove existing styles if they exist
            const existingStyles = document.getElementById('credit-assessment-styles');
            if (existingStyles) {
                existingStyles.remove();
            }

            // Add new styles to head
            document.head.insertAdjacentHTML('beforeend', styles);
        },

        // Create modal HTML structure
        createModal: function() {
            // Remove existing modal if it exists
            const existingModal = document.getElementById('credit-assessment-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const modalHTML = `
                <div id="credit-assessment-modal" class="nav-quiz-modal">
                    <div class="nav-modal-content">
                        <span class="nav-close-button">&times;</span>
                        <div id="creditAssessmentContent" class="nav-quiz-container">
                            <div class="nav-progress-container">
                                <div class="nav-progress-bar" id="quiz-progress"></div>
                                <span class="nav-progress-text">Progress: <span id="progress-percentage">0%</span></span>
                            </div>

                            <div class="nav-quiz-steps" id="quiz-steps">
                                <div class="nav-quiz-step" data-step="1">
                                    <h2 class="nav-question-title">Which best describes your current credit situation?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="no_credit">
                                            <span class="nav-option-icon">📊</span>
                                            <span class="nav-option-text">I have no credit history</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="below_580">
                                            <span class="nav-option-icon">📉</span>
                                            <span class="nav-option-text">My score is below 580</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="580_669">
                                            <span class="nav-option-icon">📈</span>
                                            <span class="nav-option-text">My score is between 580-669</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="670_739">
                                            <span class="nav-option-icon">📊</span>
                                            <span class="nav-option-text">My score is between 670-739</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="above_740">
                                            <span class="nav-option-icon">🌟</span>
                                            <span class="nav-option-text">My score is above 740</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="2" style="display: none;">
                                    <h2 class="nav-question-title">What's your main credit goal right now?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="buy_home">
                                            <span class="nav-option-icon">🏠</span>
                                            <span class="nav-option-text">Buy a home</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="new_car">
                                            <span class="nav-option-icon">🚗</span>
                                            <span class="nav-option-text">Get a new car</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="credit_card">
                                            <span class="nav-option-icon">💳</span>
                                            <span class="nav-option-text">Get a credit card or loan</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="improve_score">
                                            <span class="nav-option-icon">📈</span>
                                            <span class="nav-option-text">Improve my credit score overall</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="remove_negative">
                                            <span class="nav-option-icon">🎯</span>
                                            <span class="nav-option-text">Remove negative items from my report</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="3" style="display: none;">
                                    <h2 class="nav-question-title">How many active credit cards or loans do you currently have?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="none">
                                            <span class="nav-option-icon">0️⃣</span>
                                            <span class="nav-option-text">None</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="1-2">
                                            <span class="nav-option-icon">1️⃣</span>
                                            <span class="nav-option-text">1–2</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="3-5">
                                            <span class="nav-option-icon">3️⃣</span>
                                            <span class="nav-option-text">3–5</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="6+">
                                            <span class="nav-option-icon">6️⃣</span>
                                            <span class="nav-option-text">6 or more</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="not_sure">
                                            <span class="nav-option-icon">❓</span>
                                            <span class="nav-option-text">Not sure</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="4" style="display: none;">
                                    <h2 class="nav-question-title">Have you checked your credit report in the last 6 months?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="yes">
                                            <span class="nav-option-icon">✅</span>
                                            <span class="nav-option-text">Yes</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="no">
                                            <span class="nav-option-icon">❌</span>
                                            <span class="nav-option-text">No</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="not_sure">
                                            <span class="nav-option-icon">❓</span>
                                            <span class="nav-option-text">I'm not sure</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="5" style="display: none;">
                                    <h2 class="nav-question-title">Which of these credit issues applies to you?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="late_payments">
                                            <span class="nav-option-icon">⏰</span>
                                            <span class="nav-option-text">Late payments</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="collections">
                                            <span class="nav-option-icon">📑</span>
                                            <span class="nav-option-text">Collections accounts</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="high_balances">
                                            <span class="nav-option-icon">💰</span>
                                            <span class="nav-option-text">High credit card balances</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="bankruptcy">
                                            <span class="nav-option-icon">⚖️</span>
                                            <span class="nav-option-text">Bankruptcy</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="no_issues">
                                            <span class="nav-option-icon">✨</span>
                                            <span class="nav-option-text">No major issues — just want to improve</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="not_sure">
                                            <span class="nav-option-icon">❓</span>
                                            <span class="nav-option-text">Not sure</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="6" style="display: none;">
                                    <h2 class="nav-question-title">Would you be interested in expert help to fix your credit faster?</h2>
                                    <div class="nav-options-grid">
                                        <button class="nav-option-btn" data-value="very_interested">
                                            <span class="nav-option-icon">🎯</span>
                                            <span class="nav-option-text">Yes, I'm very interested</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="maybe">
                                            <span class="nav-option-icon">🤔</span>
                                            <span class="nav-option-text">Maybe, tell me more</span>
                                        </button>
                                        <button class="nav-option-btn" data-value="not_now">
                                            <span class="nav-option-icon">📚</span>
                                            <span class="nav-option-text">Not right now, just exploring</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="nav-quiz-step" data-step="7" style="display: none;">
                                    <h2 class="nav-question-title">Create Your JAM Engine Account</h2>
                                    <p class="nav-form-subtitle">Get access to your personalized credit guide and dashboard</p>
                                    <div class="nav-registration-form">
                                        <div class="nav-form-group">
                                            <label for="ca-fullname">Full Name</label>
                                            <input type="text" id="ca-fullname" class="nav-form-input" placeholder="Enter your full name" required>
                                        </div>
                                        <div class="nav-form-group">
                                            <label for="ca-email">Email Address</label>
                                            <input type="email" id="ca-email" class="nav-form-input" placeholder="Enter your email" required>
                                        </div>
                                        <div class="nav-form-group">
                                            <label for="ca-phone">Phone Number</label>
                                            <input type="tel" id="ca-phone" class="nav-form-input" placeholder="Enter your phone number" required>
                                        </div>
                                        <div class="nav-form-group">
                                            <label for="ca-password">Create Password</label>
                                            <input type="password" id="ca-password" class="nav-form-input" placeholder="Create a secure password" required>
                                            <small class="nav-password-hint">Must be at least 8 characters with a number and special character</small>
                                        </div>
                                        <div class="nav-form-group">
                                            <label for="ca-confirm-password">Confirm Password</label>
                                            <input type="password" id="ca-confirm-password" class="nav-form-input" placeholder="Confirm your password" required>
                                        </div>
                                        <div class="nav-form-group nav-checkbox-group">
                                            <input type="checkbox" id="ca-terms" required>
                                            <label for="ca-terms">I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a></label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="nav-quiz-navigation">
                                <button id="ca-prevBtn" class="nav-nav-btn" style="display: none;">Previous</button>
                                <button id="ca-nextBtn" class="nav-nav-btn">Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        },

        // Bind all event listeners
        bindEvents: function() {
            const modal = document.getElementById('credit-assessment-modal');
            const closeButton = modal.querySelector('.nav-close-button');
            const nextBtn = document.getElementById('ca-nextBtn');
            const prevBtn = document.getElementById('ca-prevBtn');

            // Close button
            if (closeButton) {
                closeButton.addEventListener('click', () => this.close());
            }

            // Navigation buttons
            if (nextBtn) {
                nextBtn.addEventListener('click', () => this.handleNext());
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => this.handlePrevious());
            }

            // Option buttons (delegated event)
            modal.addEventListener('click', (e) => {
                if (e.target.closest('.nav-option-btn')) {
                    this.handleOptionSelect(e);
                }
            });

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });

            // Form validation
            modal.addEventListener('input', (e) => {
                if (this.currentStep === 7) {
                    this.validateRegistrationForm();
                }
            });
        },

        // Open the credit assessment modal
        open: function() {
            this.currentStep = 1;
            this.quizData = {};
            
            const modal = document.getElementById('credit-assessment-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                this.showStep(1);
            }
        },

        // Close the modal
        close: function() {
            const modal = document.getElementById('credit-assessment-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        },

        // Show specific step
        showStep: function(step) {
            const steps = document.querySelectorAll('#credit-assessment-modal .nav-quiz-step');
            steps.forEach(s => s.style.display = 'none');

            const currentStepEl = document.querySelector(`#credit-assessment-modal .nav-quiz-step[data-step="${step}"]`);
            if (currentStepEl) {
                currentStepEl.style.display = 'block';

                if (step !== 7) {
                    const questionId = `question_${step}`;
                    const selectedValue = this.quizData[questionId];

                    if (selectedValue) {
                        currentStepEl.querySelectorAll('.nav-option-btn').forEach(btn => {
                            btn.classList.remove('nav-active', 'selected');
                        });

                        const selectedOption = currentStepEl.querySelector(`.nav-option-btn[data-value="${selectedValue}"]`);
                        if (selectedOption) {
                            selectedOption.classList.add('nav-active', 'selected');
                        }
                    }
                }
            }

            this.updateProgress(step, this.totalSteps);
            this.updateNavButtons(step, this.totalSteps);
        },

        // Update progress bar
        updateProgress: function(current, total) {
            const progressBar = document.querySelector('#credit-assessment-modal .nav-progress-bar');
            const progressText = document.querySelector('#credit-assessment-modal .nav-progress-text');

            if (progressBar) {
                const percentage = (current / total) * 100;
                progressBar.style.setProperty('--progress-width', `${percentage}%`);
                progressBar.style.background = `linear-gradient(to right, #008080 ${percentage}%, #f0f0f0 ${percentage}%)`;
            }

            if (progressText) {
                progressText.textContent = `Step ${current} of ${total}`;
            }
        },

        // Update navigation buttons
        updateNavButtons: function(current, total) {
            const prevBtn = document.getElementById('ca-prevBtn');
            const nextBtn = document.getElementById('ca-nextBtn');

            if (prevBtn) {
                prevBtn.style.display = current === 1 ? 'none' : 'block';
            }

            if (nextBtn) {
                nextBtn.textContent = current === total ? 'Create Account' : 'Next';

                if (current === 7) {
                    this.validateRegistrationForm();
                } else {
                    const questionId = `question_${current}`;
                    const hasSelection = this.quizData[questionId] !== undefined;
                    nextBtn.disabled = !hasSelection;
                }
            }
        },

        // Handle option selection
        handleOptionSelect: function(e) {
            e.preventDefault();
            const button = e.target.closest('.nav-option-btn');
            if (!button) return;

            const currentStepEl = document.querySelector(`#credit-assessment-modal .nav-quiz-step[data-step="${this.currentStep}"]`);
            const options = currentStepEl.querySelectorAll('.nav-option-btn');

            options.forEach(opt => {
                opt.classList.remove('nav-active', 'selected');
            });

            button.classList.add('nav-active', 'selected');

            const value = button.getAttribute('data-value');
            const questionId = `question_${this.currentStep}`;
            this.quizData[questionId] = value;

            const nextBtn = document.getElementById('ca-nextBtn');
            if (nextBtn) {
                nextBtn.disabled = false;
            }
        },

        // Handle next button
        handleNext: function() {
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.showStep(this.currentStep);
            } else {
                this.submitRegistration();
            }
        },

        // Handle previous button
        handlePrevious: function() {
            if (this.currentStep > 1) {
                this.currentStep--;
                this.showStep(this.currentStep);
            }
        },

        // Validate registration form
        validateRegistrationForm: function() {
            const fullname = document.getElementById('ca-fullname');
            const email = document.getElementById('ca-email');
            const phone = document.getElementById('ca-phone');
            const password = document.getElementById('ca-password');
            const confirmPassword = document.getElementById('ca-confirm-password');
            const terms = document.getElementById('ca-terms');
            const nextBtn = document.getElementById('ca-nextBtn');

            if (!fullname || !email || !phone || !password || !confirmPassword || !terms || !nextBtn) {
                return;
            }

            const isFullnameFilled = fullname.value.trim() !== '';
            const isEmailFilled = email.value.trim() !== '';
            const isPhoneFilled = phone.value.trim() !== '';
            const isPasswordFilled = password.value !== '';
            const isConfirmPasswordFilled = confirmPassword.value !== '';
            const isTermsChecked = terms.checked;
            const doPasswordsMatch = password.value === confirmPassword.value;
            const isPasswordStrong = /^(?=.*[0-9])(?=.*[!@#$%^&*])(.{8,})$/.test(password.value);

            const passwordHint = document.querySelector('#credit-assessment-modal .nav-password-hint');
            if (passwordHint) {
                if (isPasswordFilled && isConfirmPasswordFilled && !doPasswordsMatch) {
                    passwordHint.textContent = "Passwords do not match";
                    passwordHint.style.color = "red";
                } else if (isPasswordFilled && !isPasswordStrong) {
                    passwordHint.textContent = "Password must be at least 8 characters with a number and special character";
                    passwordHint.style.color = "red";
                } else {
                    passwordHint.textContent = "Must be at least 8 characters with a number and special character";
                    passwordHint.style.color = "";
                }
            }

            nextBtn.disabled = !(
                isFullnameFilled &&
                isEmailFilled &&
                isPhoneFilled &&
                isPasswordFilled &&
                isConfirmPasswordFilled &&
                doPasswordsMatch &&
                isPasswordStrong &&
                isTermsChecked
            );
        },

        // Submit registration
        submitRegistration: function() {
            const fullname = document.getElementById('ca-fullname').value.trim();
            const email = document.getElementById('ca-email').value.trim();
            const phone = document.getElementById('ca-phone').value.trim();

            const registrationData = {
                ...this.quizData,
                fullname: fullname,
                email: email,
                phone: phone,
            };

            console.log("Registration submitted with data:", registrationData);

            if (typeof analytics !== 'undefined') {
                analytics.track('AccountRegistration', {
                    quizData: registrationData,
                    timestamp: new Date().toISOString()
                });
            }

            window.location.href = "https://jamcapitalconsultants.com/dashboard";
        }
    };

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => CreditAssessment.init());
    } else {
        CreditAssessment.init();
    }

    // Make globally available
    window.CreditAssessment = CreditAssessment;
    
    // Convenience functions for easy inline use
    window.openCreditAssessment = function() {
        CreditAssessment.open();
    };
    
    window.closeCreditAssessment = function() {
        CreditAssessment.close();
    };

})(window); 