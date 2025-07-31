// JAM Get Started Module
// Extracted from NavGetStarted.html for standalone use

(function () {
    'use strict';

    // JAM Get Started Module
    const JAMGetStartedModule = (function () {
        let currentStep = 1;
        const totalSteps = 7;
        let quizData = {};
        let isInitialized = false;
        let currentContainer = null;

        // Initialize module
        function init(containerId) {
            console.log('🚀 Initializing JAM Get Started Module...');
            
            if (isInitialized) {
                console.log('⚠️ Module already initialized, resetting...');
                reset();
            }

            currentContainer = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
            
            if (!currentContainer) {
                console.error('❌ Container not found:', containerId);
                return false;
            }

            console.log('✅ Container found:', currentContainer);
            isInitialized = true;
            return true;
        }

        // Open quiz modal
        function openQuizModal() {
            console.log('🎯 Opening JAM Get Started Quiz...');
            
            if (!isInitialized) {
                console.error('❌ Module not initialized');
                return false;
            }

            // Reset to step 1
            currentStep = 1;
            quizData = {};

            // Create modal HTML
            const modalHTML = `
                <div id="nav-quizModal" class="nav-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 10000; align-items: center; justify-content: center;">
                    <div class="nav-modal-content" style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">
                        <button id="nav-closeBtn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
                        
                        <!-- Step 1: Welcome -->
                        <div id="nav-step-1" class="nav-step" style="display: block;">
                            <h2 style="color: #333; margin-bottom: 20px;">Welcome to JAM Capital Consultants</h2>
                            <p style="color: #666; margin-bottom: 30px;">Let's get to know you better to provide personalized financial guidance.</p>
                            <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; font-size: 16px;">Get Started</button>
                        </div>

                        <!-- Step 2: Investment Experience -->
                        <div id="nav-step-2" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">What's your investment experience?</h2>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <button class="nav-option-btn" data-value="beginner" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Beginner - New to investing</button>
                                <button class="nav-option-btn" data-value="intermediate" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Intermediate - Some experience</button>
                                <button class="nav-option-btn" data-value="advanced" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Advanced - Experienced investor</button>
                            </div>
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Next</button>
                            </div>
                        </div>

                        <!-- Step 3: Investment Goals -->
                        <div id="nav-step-3" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">What are your primary investment goals?</h2>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <button class="nav-option-btn" data-value="retirement" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Retirement planning</button>
                                <button class="nav-option-btn" data-value="wealth" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Wealth building</button>
                                <button class="nav-option-btn" data-value="income" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Passive income</button>
                                <button class="nav-option-btn" data-value="education" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Education funding</button>
                            </div>
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Next</button>
                            </div>
                        </div>

                        <!-- Step 4: Risk Tolerance -->
                        <div id="nav-step-4" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">How would you describe your risk tolerance?</h2>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <button class="nav-option-btn" data-value="conservative" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Conservative - Prefer stable, low-risk investments</button>
                                <button class="nav-option-btn" data-value="moderate" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Moderate - Balanced approach to risk and return</button>
                                <button class="nav-option-btn" data-value="aggressive" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Aggressive - Willing to take higher risks for higher returns</button>
                            </div>
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Next</button>
                            </div>
                        </div>

                        <!-- Step 5: Investment Timeline -->
                        <div id="nav-step-5" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">What's your investment timeline?</h2>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <button class="nav-option-btn" data-value="short" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Short-term (1-3 years)</button>
                                <button class="nav-option-btn" data-value="medium" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Medium-term (3-10 years)</button>
                                <button class="nav-option-btn" data-value="long" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">Long-term (10+ years)</button>
                            </div>
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Next</button>
                            </div>
                        </div>

                        <!-- Step 6: Investment Amount -->
                        <div id="nav-step-6" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">What's your typical investment amount?</h2>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <button class="nav-option-btn" data-value="small" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">$1,000 - $10,000</button>
                                <button class="nav-option-btn" data-value="medium" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">$10,000 - $100,000</button>
                                <button class="nav-option-btn" data-value="large" style="background: #f8f9fa; border: 2px solid #dee2e6; padding: 15px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.3s;">$100,000+</button>
                            </div>
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Next</button>
                            </div>
                        </div>

                        <!-- Step 7: Registration -->
                        <div id="nav-step-7" class="nav-step" style="display: none;">
                            <h2 style="color: #333; margin-bottom: 20px;">Create Your Account</h2>
                            <p style="color: #666; margin-bottom: 30px;">Let's create your personalized investment profile.</p>
                            
                            <form id="nav-registration-form" style="display: flex; flex-direction: column; gap: 15px;">
                                <input type="text" id="nav-fullname" placeholder="Full Name" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                                <input type="email" id="nav-email" placeholder="Email Address" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                                <input type="tel" id="nav-phone" placeholder="Phone Number" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                                <input type="password" id="nav-password" placeholder="Password" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                                
                                <select id="nav-security-question" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                                    <option value="">Select a security question</option>
                                    <option value="What was your first pet's name?">What was your first pet's name?</option>
                                    <option value="In what city were you born?">In what city were you born?</option>
                                    <option value="What was your mother's maiden name?">What was your mother's maiden name?</option>
                                    <option value="What was the name of your first school?">What was the name of your first school?</option>
                                </select>
                                
                                <input type="text" id="nav-security-answer" placeholder="Security Answer" required style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                            </form>
                            
                            <div style="margin-top: 20px;">
                                <button id="nav-prevBtn" class="nav-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Previous</button>
                                <button id="nav-nextBtn" class="nav-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: none;">Create Account</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to container
            currentContainer.innerHTML = modalHTML;
            currentContainer.style.display = 'block';

            // Attach event listeners
            attachEventListeners();

            console.log('✅ Quiz modal opened successfully');
            return true;
        }

        // Close quiz modal
        function closeQuizModal() {
            console.log('🔴 Closing JAM Get Started Quiz...');
            
            // Look for modal in both container and body
            let modal = currentContainer ? currentContainer.querySelector('#nav-quizModal') : null;
            if (!modal) {
                modal = document.querySelector('#nav-quizModal');
            }

            if (modal) {
                modal.remove();
                console.log('✅ Modal removed');
            }

            // Reset container
            if (currentContainer) {
                currentContainer.innerHTML = '';
                currentContainer.style.display = 'none';
            }

            // Reset module state
            reset();
            console.log('✅ Quiz modal closed and reset');
        }

        // Show specific step
        function showStep(step) {
            console.log('🔄 Showing step:', step);
            
            if (step < 1 || step > totalSteps) {
                console.error('❌ Invalid step:', step);
                return;
            }

            // Hide all steps
            const steps = document.querySelectorAll('.nav-step');
            steps.forEach(s => s.style.display = 'none');

            // Show current step
            const currentStepElement = document.getElementById(`nav-step-${step}`);
            if (currentStepElement) {
                currentStepElement.style.display = 'block';
                currentStep = step;
                console.log('✅ Step', step, 'displayed');
            } else {
                console.error('❌ Step element not found:', `nav-step-${step}`);
            }
        }

        // Handle option selection
        function handleOptionSelect(e) {
            const button = e.target;
            const value = button.getAttribute('data-value');
            
            console.log('🎯 Option selected:', value, 'for step:', currentStep);

            // Store the selection
            const stepKey = `step${currentStep}`;
            quizData[stepKey] = value;

            // Update button styling
            const allButtons = button.parentElement.querySelectorAll('.nav-option-btn');
            allButtons.forEach(btn => {
                btn.style.background = '#f8f9fa';
                btn.style.borderColor = '#dee2e6';
            });
            button.style.background = '#007bff';
            button.style.borderColor = '#007bff';
            button.style.color = 'white';

            // Show next button
            const nextBtn = document.querySelector('#nav-nextBtn');
            if (nextBtn) {
                nextBtn.style.display = 'inline-block';
            }

            console.log('✅ Option selection handled');
        }

        // Validate registration form
        function validateRegistrationForm() {
            const fullname = document.querySelector('#nav-fullname');
            const email = document.querySelector('#nav-email');
            const phone = document.querySelector('#nav-phone');
            const password = document.querySelector('#nav-password');
            const securityQuestion = document.querySelector('#nav-security-question');
            const securityAnswer = document.querySelector('#nav-security-answer');
            const nextBtn = document.querySelector('#nav-nextBtn');

            if (!fullname || !email || !phone || !password || !securityQuestion || !securityAnswer) {
                console.log('❌ Form elements not found');
                return false;
            }

            const isValid = fullname.value.trim() && 
                           email.value.trim() && 
                           phone.value.trim() && 
                           password.value.length >= 6 && 
                           securityQuestion.value && 
                           securityAnswer.value.trim().length >= 2;

            if (nextBtn) {
                nextBtn.disabled = !isValid;
            }

            console.log('🔍 Form validation result:', isValid);
            return isValid;
        }

        // Submit registration
        async function submitRegistration() {
            console.log('🚀 Submitting registration...');

            // Get form elements
            let fullname = currentContainer ? currentContainer.querySelector('#nav-fullname') : null;
            let email = currentContainer ? currentContainer.querySelector('#nav-email') : null;
            let phone = currentContainer ? currentContainer.querySelector('#nav-phone') : null;
            let password = currentContainer ? currentContainer.querySelector('#nav-password') : null;
            let securityQuestion = currentContainer ? currentContainer.querySelector('#nav-security-question') : null;
            let securityAnswer = currentContainer ? currentContainer.querySelector('#nav-security-answer') : null;
            let nextBtn = currentContainer ? currentContainer.querySelector('#nav-nextBtn') : null;

            // If not found in container, try document body
            if (!fullname) fullname = document.querySelector('#nav-fullname');
            if (!email) email = document.querySelector('#nav-email');
            if (!phone) phone = document.querySelector('#nav-phone');
            if (!password) password = document.querySelector('#nav-password');
            if (!securityQuestion) securityQuestion = document.querySelector('#nav-security-question');
            if (!securityAnswer) securityAnswer = document.querySelector('#nav-security-answer');
            if (!nextBtn) nextBtn = document.querySelector('#nav-nextBtn');

            if (!fullname || !email || !phone || !password || !securityQuestion || !securityAnswer) {
                console.log('❌ Missing form elements for submission');
                alert('Please fill in all fields');
                return;
            }

            const fullnameValue = fullname.value.trim();
            const emailValue = email.value.trim();
            const phoneValue = phone.value.trim();
            const passwordValue = password.value;
            const securityQuestionValue = securityQuestion.value;
            const securityAnswerValue = securityAnswer.value.trim();

            // Basic validation
            if (passwordValue.length < 6) {
                alert('Password must be at least 6 characters long');
                return;
            }

            if (securityAnswerValue.length < 2) {
                alert('Security answer must be at least 2 characters long');
                return;
            }

            // Show loading state
            if (nextBtn) {
                nextBtn.innerHTML = 'Creating Account...';
                nextBtn.disabled = true;
            }

            try {
                const response = await fetch('https://jam-capital-backend.azurewebsites.net/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: fullnameValue,
                        email: emailValue,
                        phone: phoneValue,
                        password: passwordValue,
                        securityQuestion: securityQuestionValue,
                        securityAnswer: securityAnswerValue.toLowerCase()
                    })
                });

                const data = await response.json();

                if (data.success) {
                    console.log('🎉 Registration successful!');
                    
                    // Set registration flags
                    sessionStorage.setItem('comingFromRegistration', 'true');
                    sessionStorage.setItem('registrationTimestamp', Date.now().toString());

                    // Close modal and redirect
                    closeQuizModal();
                    setTimeout(() => {
                        window.location.href = 'Dashboard.html';
                    }, 1000);
                } else {
                    console.error('❌ Registration failed:', data.message);
                    alert(data.message || 'Registration failed. Please try again.');
                    
                    // Reset button state
                    if (nextBtn) {
                        nextBtn.innerHTML = 'Create Account';
                        nextBtn.disabled = false;
                    }
                }
            } catch (error) {
                console.error('❌ Error during registration:', error);
                alert('Network error. Please check your connection and try again.');
                
                // Reset button state
                if (nextBtn) {
                    nextBtn.innerHTML = 'Create Account';
                    nextBtn.disabled = false;
                }
            }
        }

        // Attach event listeners
        function attachEventListeners() {
            // Close button
            const closeBtn = document.querySelector('#nav-closeBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeQuizModal);
            }

            // Option buttons
            const optionBtns = document.querySelectorAll('.nav-option-btn');
            optionBtns.forEach(btn => {
                btn.addEventListener('click', handleOptionSelect);
            });

            // Next button
            const nextBtn = document.querySelector('#nav-nextBtn');
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    if (currentStep < totalSteps) {
                        showStep(currentStep + 1);
                    } else {
                        submitRegistration();
                    }
                });
            }

            // Previous button
            const prevBtn = document.querySelector('#nav-prevBtn');
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    if (currentStep > 1) {
                        showStep(currentStep - 1);
                    }
                });
            }

            // Form validation for registration step
            const formInputs = document.querySelectorAll('#nav-registration-form input, #nav-registration-form select');
            formInputs.forEach(input => {
                input.addEventListener('input', validateRegistrationForm);
            });
        }

        // Reset module
        function reset() {
            currentStep = 1;
            quizData = {};
            isInitialized = false;
            currentContainer = null;
        }

        // Public API
        return {
            init: init,
            reset: reset,
            openQuiz: openQuizModal,
            closeQuiz: closeQuizModal,
            showStep: showStep,
            handleOptionSelect: handleOptionSelect,
            submitRegistration: submitRegistration,
            validateRegistrationForm: validateRegistrationForm,
            currentStep: function () { return currentStep; },
            totalSteps: function () { return totalSteps; },
            isInitialized: function () { return isInitialized; },
            getQuizData: function () { return { ...quizData }; }
        };
    })();

    // Expose globally
    window.JAMGetStartedModule = JAMGetStartedModule;

    // Signal module is loaded
    if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('jamGetStartedModuleLoaded'));
        console.log('JAM Get Started Module loaded and available globally');
    }

})(); 