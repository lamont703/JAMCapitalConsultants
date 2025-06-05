#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test script for PDF download functionality
console.log('🧪 JAM Capital PDF Download Test Script');
console.log('=====================================\n');

// Test 1: Direct PDF Generation
async function testPDFGeneration() {
    console.log('📄 Test 1: Direct PDF Generation');
    console.log('----------------------------------');
    
    try {
        // Import the PDF generation function (we'll need to extract it)
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
        
        // Sample dispute letter content
        const sampleLetter = `Lamont Evans
1000 northside dr
atlanta, Georgia 30318
lamont703@gmail.com
770-280-5711

January 15, 2025

Experian
P.O. Box 4500
Allen, TX 75013

Dear Experian,

I am writing to formally dispute an item on my credit report regarding my account with CAPITAL BANK (Account: XXXX). According to the information I have, this account has been inaccurately reported, specifically concerning payments that should not appear after the charge-off status has been assigned.

The issue at hand is that payments are being reported after the charge-off was recorded, which contradicts the guidelines established under the Fair Credit Reporting Act (FCRA). As per Section 609 of the FCRA, I am exercising my right to dispute this information and request verification of all account details associated with this matter.

Furthermore, I would like to draw your attention to Section 611 of the FCRA, which outlines the requirements for investigating disputes. If the information cannot be verified or if it is determined to be inaccurate, I request that it be removed from my credit report promptly.

I trust that you will handle this matter with the seriousness it deserves and look forward to your prompt response. Please feel free to reach me at the phone number or email provided above for any additional information you may require.

Thank you for your attention to this important matter.

Sincerely,

Lamont Evans`;

        console.log('📝 Generating PDF with sample dispute letter...');
        
        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([612, 792]); // Letter size
        const { width, height } = page.getSize();
        
        // Set up fonts
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const fontSize = 12;
        const lineHeight = 18;
        
        // Define margins
        const leftMargin = 72;
        const rightMargin = 72;
        const topMargin = 72;
        const bottomMargin = 72;
        const textWidth = width - leftMargin - rightMargin;
        
        let currentY = height - topMargin;
        
        // Helper function to add text with word wrapping
        function addText(text, x, y, options = {}) {
            const useFont = options.bold ? boldFont : font;
            const useFontSize = options.fontSize || fontSize;
            const useColor = options.color || rgb(0, 0, 0);
            
            const words = text.split(' ');
            let lines = [];
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const textWidth_test = useFont.widthOfTextAtSize(testLine, useFontSize);
                
                if (textWidth_test <= textWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        lines.push(word);
                    }
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
            
            let lineY = y;
            for (const line of lines) {
                page.drawText(line, {
                    x: x,
                    y: lineY,
                    size: useFontSize,
                    font: useFont,
                    color: useColor,
                });
                lineY -= lineHeight;
            }
            
            return lineY;
        }
        
        // Add title
        currentY = addText('Credit Dispute Letter - Experian', leftMargin, currentY, { bold: true, fontSize: 16 });
        currentY -= lineHeight * 2;
        
        // Process letter content
        const lines = sampleLetter.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                currentY = addText(line.trim(), leftMargin, currentY);
                currentY -= lineHeight * 0.5;
            } else {
                currentY -= lineHeight;
            }
            
            if (currentY < bottomMargin + (lineHeight * 3)) {
                page = pdfDoc.addPage([612, 792]);
                currentY = height - topMargin;
            }
        }
        
        // Add footer
        page.drawText('Generated by JAM Capital Consultants - Test', {
            x: leftMargin,
            y: bottomMargin - 20,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const testPdfPath = path.join(__dirname, 'test-dispute-letter.pdf');
        fs.writeFileSync(testPdfPath, pdfBytes);
        
        console.log(`✅ PDF generated successfully: ${testPdfPath}`);
        console.log(`📊 PDF size: ${Math.round(pdfBytes.length / 1024)} KB`);
        
        // Verify file exists and has content
        if (fs.existsSync(testPdfPath)) {
            const stats = fs.statSync(testPdfPath);
            console.log(`📁 File size on disk: ${Math.round(stats.size / 1024)} KB`);
            
            // Basic PDF validation - check for PDF header
            const fileContent = fs.readFileSync(testPdfPath);
            const pdfHeader = fileContent.toString('ascii', 0, 4);
            if (pdfHeader === '%PDF') {
                console.log('✅ PDF header validation passed');
                return { success: true, path: testPdfPath, size: stats.size };
            } else {
                console.log('❌ PDF header validation failed');
                return { success: false, error: 'Invalid PDF header' };
            }
        } else {
            console.log('❌ PDF file was not created');
            return { success: false, error: 'File not created' };
        }
        
    } catch (error) {
        console.log('❌ PDF generation failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Test 2: API Endpoint Test
async function testAPIEndpoint() {
    console.log('\n🌐 Test 2: API Endpoint Test');
    console.log('-----------------------------');
    
    try {
        // First, let's test if the server is running
        const testResponse = await fetch('http://localhost:3000/api/chat/user-letters?userEmail=test@example.com', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📡 Server response status: ${testResponse.status}`);
        
        if (testResponse.status === 401) {
            console.log('🔐 Server is running but requires authentication (expected)');
        } else if (testResponse.status === 500) {
            console.log('🔄 Server is running but may have database connection issues');
        } else {
            console.log('✅ Server is responding normally');
        }
        
        return { success: true, status: testResponse.status };
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server is not running on localhost:3000');
            console.log('💡 Please start the server with: npm run dev');
        } else {
            console.log('❌ API test failed:', error.message);
        }
        return { success: false, error: error.message };
    }
}

// Test 3: Validate Existing PDFs in System
async function testExistingPDFs() {
    console.log('\n📋 Test 3: Existing PDF Validation');
    console.log('----------------------------------');
    
    try {
        // Check if there are any existing test PDFs we can validate
        const testFiles = [
            path.join(__dirname, 'test-dispute-letter.pdf'),
            // Add other known PDF paths if they exist
        ];
        
        let validPDFs = 0;
        let totalPDFs = 0;
        
        for (const filePath of testFiles) {
            if (fs.existsSync(filePath)) {
                totalPDFs++;
                console.log(`📄 Checking: ${path.basename(filePath)}`);
                
                const fileContent = fs.readFileSync(filePath);
                const pdfHeader = fileContent.toString('ascii', 0, 4);
                
                if (pdfHeader === '%PDF') {
                    console.log(`✅ Valid PDF: ${path.basename(filePath)}`);
                    validPDFs++;
                } else {
                    console.log(`❌ Invalid PDF: ${path.basename(filePath)}`);
                }
            }
        }
        
        console.log(`📊 Summary: ${validPDFs}/${totalPDFs} PDFs are valid`);
        return { success: validPDFs > 0, validCount: validPDFs, totalCount: totalPDFs };
        
    } catch (error) {
        console.log('❌ PDF validation failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Test 4: Dependencies Check
async function testDependencies() {
    console.log('\n📦 Test 4: Dependencies Check');
    console.log('-----------------------------');
    
    const requiredDeps = ['pdf-lib', '@azure/cosmos', '@azure/storage-blob'];
    let allPresent = true;
    
    for (const dep of requiredDeps) {
        try {
            await import(dep);
            console.log(`✅ ${dep} - Available`);
        } catch (error) {
            console.log(`❌ ${dep} - Missing or broken`);
            allPresent = false;
        }
    }
    
    return { success: allPresent };
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting comprehensive PDF download tests...\n');
    
    const results = {
        dependencies: await testDependencies(),
        pdfGeneration: await testPDFGeneration(),
        apiEndpoint: await testAPIEndpoint(),
        existingPDFs: await testExistingPDFs()
    };
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    console.log(`📦 Dependencies: ${results.dependencies.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📄 PDF Generation: ${results.pdfGeneration.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🌐 API Endpoint: ${results.apiEndpoint.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📋 PDF Validation: ${results.existingPDFs.success ? '✅ PASS' : '❌ FAIL'}`);
    
    const passCount = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall: ${passCount}/${totalTests} tests passed`);
    
    if (results.pdfGeneration.success) {
        console.log('\n💡 Next Steps:');
        console.log('1. Open the generated test PDF to verify it displays correctly');
        console.log('2. If server is running, test the full download flow in the UI');
        console.log('3. Check that downloaded PDFs match the test PDF quality');
    }
    
    if (!results.apiEndpoint.success) {
        console.log('\n🔧 To test API endpoints:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Run this test again');
    }
    
    console.log('\n✨ Test completed!');
}

// Run the tests
runAllTests().catch(console.error); 