// ==UserScript==
// @name         Welearnans
// @version      1.2
// @description  A simple WElearn auto-answer-filling script
// @author       hap,Kaczev
// @match        *://welearn.sflep.com/*
// @icon         https://welearn.sflep.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const UI_STYLE = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 999999;
        font-family: "Microsoft YaHei", sans-serif;
    `;

    const BUTTON_STYLE = `
        display: block;
        padding: 12px 20px;
        background-color: #ff5722;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        font-size: 16px;
        font-weight: bold;
        transition: transform 0.2s, box-shadow 0.2s;
    `;

    const triggerReadyEvents = (el) => {
      try {
        el.click?.();
        el.focus?.();
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('focus', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) {}
    };

    const removeAnswersMayVary = (doc) => {
        try {
            const root = doc.body || doc;
            const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => node.nodeValue && node.nodeValue.includes('(Answers may vary.)') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
            }, false);
            const nodes = [];
            let n;
            while (n = walker.nextNode()) nodes.push(n);
            nodes.forEach(node => {
                node.nodeValue = node.nodeValue.replace(/\(Answers may vary\.[)\s]*/g, '').replace(/\(Answers may vary\)\s*/g, '');
            });
        } catch (e) {}
    };

    const removeAnswersMayVaryAll = () => {
        try {
            removeAnswersMayVary(document);
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    if (iframe.contentDocument) removeAnswersMayVary(iframe.contentDocument);
                } catch (e) {}
            });
        } catch (e) {}
    };

    // run once now and then periodically to ensure the sentence is removed
    removeAnswersMayVaryAll();
    setInterval(removeAnswersMayVaryAll, 2000);
    
    const triggerCompleteEvents = (el) => {
      try {
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        
        const win = el.ownerDocument?.defaultView || window;
        const angular = win.angular;
        if (angular) {
            try {
                const ngEl = angular.element(el);
                ngEl.triggerHandler?.('hover');
                ngEl.triggerHandler?.('keyup');
                ngEl.triggerHandler?.('blur');
                ngEl.triggerHandler?.('change');
                ngEl.triggerHandler?.('input');
            } catch(e) {}
        }
      } catch (e) {}
    };

    const normalizeText = (text) => (text ?? '').trim().toUpperCase();

    const normalizeAnswer = (text) => {
        if (!text) return '';
        const firstOption = text.split(/[\/|]/)[0];
        
        return firstOption.trim()
            .replace(/^[A-Z]\.\s*/, '')
            .replace(/\s+/g, ' ');
    };

    const fillEtBlank = (container) => {
        let solution = '';
        
        const keyEl = container.querySelector('span.key, .key');
        if (keyEl) {
            const rawText = keyEl.textContent || '';
            solution = normalizeAnswer(rawText.split('|')[0]);
        }

        if (!solution) solution = container.getAttribute('key');

        if (!solution) {
            const stemContainer = container.closest('[et-stem-index]') || container.parentElement?.parentElement;
            if (stemContainer) {
                const visibleBox = stemContainer.querySelector('.visible-box');
                if (visibleBox) solution = normalizeAnswer(visibleBox.textContent);
            }
        }

        if (!solution && container.parentElement) {
            const sibling = container.parentElement.querySelector('.visible-box');
            if (sibling) solution = normalizeAnswer(sibling.textContent);
        }

        if (!solution) {
            const gAttr = container.getAttribute('g');
            if (gAttr && gAttr.trim()) {
                try {
                    const parsed = JSON.parse(gAttr);
                    if (typeof parsed === 'string') solution = normalizeAnswer(parsed);
                    else if (parsed.answer || parsed.key) solution = normalizeAnswer(parsed.answer || parsed.key);
                } catch {
                    solution = normalizeAnswer(gAttr);
                }
            }
        }

        if (!solution) return false;

        const textInputSelector = 'textarea, [contenteditable], input.blank, input[type="text"]';
        let inputEl = container.querySelector(textInputSelector);
        
        if (!inputEl) {
            const etItem = container.closest('et-item');
            if (etItem) {
                const candidateInputs = Array.from(etItem.querySelectorAll(textInputSelector))
                    .filter((el) => !el.closest('et-blank'));
                
                if (candidateInputs.length) {
                    const blanksNeedingExternal = Array.from(etItem.querySelectorAll('et-blank'))
                        .filter((blank) => !blank.querySelector(textInputSelector));
                    const externalIndex = blanksNeedingExternal.indexOf(container);
                    if (externalIndex > -1) {
                         inputEl = candidateInputs[externalIndex] || null;
                    }
                }
            }
        }

        if (!inputEl) return false;

        const isContentEditable = inputEl.hasAttribute('contenteditable');

        triggerReadyEvents(inputEl);
        
        if ((inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') && !isContentEditable) {
          inputEl.value = solution;
          updateWebFrameworks(inputEl, solution);
        } else {
          inputEl.textContent = solution;
        }
        
        triggerCompleteEvents(inputEl);
        
        return true;
    };

    const updateWebFrameworks = (el, value) => {
        const win = el.ownerDocument?.defaultView || window;
        
        try {
            const proto = Object.getPrototypeOf(el);
            const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (nativeValueSetter) {
                nativeValueSetter.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } catch(e) {}

        if (win.angular) {
            try {
                const ngEl = win.angular.element(el);
                const ngModel = ngEl.controller('ngModel');
                if (ngModel) {
                    ngModel.$setViewValue(value);
                    ngModel.$render?.();
                }
                const scope = ngEl.scope();
                if (scope && !scope.$$phase && scope.$apply) {
                    scope.$apply();
                }
            } catch (e) {}
        }
    };

    const fillEtChoice = (container) => {
        let options = Array.from(container.querySelectorAll('li'));
        if (options.length === 0) {
            options = Array.from(container.querySelectorAll('span[ng-click*="select"]'));
        }
        if (options.length === 0) return false;

        let keyAttr = container.getAttribute('key');
        if (!keyAttr) {
            const keyEl = container.querySelector('span.key');
            if (keyEl) keyAttr = keyEl.textContent;
        }

        if (!keyAttr) return false;

        const alreadyChosen = container.querySelector('li.chosen, li.active, li.selected, span.chosen, span.active');
        if (alreadyChosen) return false;

        const answerKeys = keyAttr.split(/[,，]/).map(k => k.trim());
        let clicked = false;

        for (const answerKey of answerKeys) {
            let idx = -1;
            if (/^[A-Za-z]$/.test(answerKey)) {
                idx = answerKey.toUpperCase().charCodeAt(0) - 65;
            } else if (/^\d+$/.test(answerKey)) {
                idx = parseInt(answerKey, 10) - 1;
            }

            if (idx >= 0 && idx < options.length) {
                const targetOption = options[idx];
                targetOption.click();
                triggerReadyEvents(targetOption);
                clicked = true;
            }
        }
        return clicked;
    };

    const fillEtTof = (container) => {
        const key = container.getAttribute('key');
        if (!key) return false;

        const alreadyChosen = container.querySelector('li.chosen, li.active');
        if (alreadyChosen) return false;

        const options = Array.from(container.querySelectorAll('li'));
        if (options.length < 2) return false;

        const normalize = s => s.trim().toLowerCase().charAt(0);
        const targetVal = normalize(key);
        
        let targetIdx = -1;
        if (['t', '1', 'a', 'y'].includes(targetVal)) targetIdx = 0;
        else targetIdx = 1;

        if (options[targetIdx]) {
            options[targetIdx].click();
            triggerReadyEvents(options[targetIdx]);
            return true;
        }
        return false;
    };

    const fillDataInput = (input) => {
        let solution = '';
        
        if (input.dataset.solution) {
            solution = input.dataset.solution;
        } 
        
        if (!solution) {
             let context = input.parentElement;
             for (let i = 0; i < 3 && context; i++) {
                 const resEl = context.querySelector('div[data-itemtype="result"]');
                 if (resEl) {
                     solution = resEl.textContent;
                     break;
                 }
                 context = context.parentElement;
             }
        }

        if (!solution) return false;

        solution = normalizeAnswer(solution);

        if (input.hasAttribute('readonly')) {
            input.click(); 
            
            const wordBanks = document.querySelectorAll('ul.ChooseSheet_cell, ul[data-itemtype="sheet"]');
            let matched = false;
            
            for (const bank of wordBanks) {
                const options = Array.from(bank.querySelectorAll('li'));
                for (const opt of options) {
                    const optText = normalizeAnswer(opt.textContent);
                    if (optText === solution) {
                        try {
                            opt.click();
                            if (!matched) opt.querySelector('span')?.click(); 
                        } catch (e) {}
                        
                        matched = true;
                        input.style.backgroundColor = '#d4edda';
                        break;
                    }
                }
                if (matched) break;
            }
            
            if (matched) return true;

            input.removeAttribute('readonly');
            input.placeholder = ''; 
        }
        
        if (input.value && normalizeText(input.value) === normalizeText(solution)) return false;

        triggerReadyEvents(input);
        input.value = solution;
        updateWebFrameworks(input, solution);
        
        triggerCompleteEvents(input);

        input.style.backgroundColor = '#e8f0fe';

        return true;
    };

    const fillDataChoice = (ul) => {
        const correctLi = ul.querySelector('li[data-solution]');
        if (!correctLi) return false;

        if (correctLi.classList.contains('active') || 
            correctLi.classList.contains('selected') || 
            correctLi.classList.contains('chosen') ||
            correctLi.hasAttribute('data-choiced')) {
            return false;
        }
        
        const anySelected = ul.querySelector('.active, .selected, .chosen');
        if (anySelected) return false;

        correctLi.click();
        triggerReadyEvents(correctLi);
        return true;
    };

    const runFill = () => {
        const docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try { 
                if (iframe.contentDocument) docs.push(iframe.contentDocument); 
            } catch(e) {}
        });

        let totalFilled = 0;
        let specialInputFilled = false;

        docs.forEach(doc => {
            doc.querySelectorAll('et-blank').forEach(el => {
                if (fillEtBlank(el)) totalFilled++;
            });
            
            doc.querySelectorAll('et-choice').forEach(el => {
                if (fillEtChoice(el)) totalFilled++;
            });

            doc.querySelectorAll('et-tof').forEach(el => {
                if (fillEtTof(el)) totalFilled++;
            });

            doc.querySelectorAll('input[data-itemtype="input"]').forEach(el => {
                if (fillDataInput(el)) {
                    totalFilled++;
                    specialInputFilled = true;
                }
            });

            doc.querySelectorAll('ul[data-itemtype="options"]').forEach(el => {
                if (fillDataChoice(el)) totalFilled++;
            });


            doc.querySelectorAll('textarea[data-itemtype="textarea"]').forEach(el => {
                if (fillDataInput(el)) totalFilled++;
            });
        });

        const msg = `已尝试填充 ${totalFilled} 道题目。`;
        if (specialInputFilled) {
            console.log('[WeLearn Helper]', msg + ' 检测到特殊填空题，已触发自动刷新。');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            console.log('[WeLearn Helper]', msg + '\n如果填空题有文字但未变色，请手动点一下输入框。');
        }
    };

    const createPanel = () => {
        if (document.getElementById('welearn-helper-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'welearn-helper-panel';
        panel.style.cssText = UI_STYLE;

        const btn = document.createElement('button');
        btn.innerText = '🚀 一键填写';
        btn.style.cssText = BUTTON_STYLE;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            runFill();
            const originalText = btn.innerText;
            btn.innerText = '✅ 已执行';
            setTimeout(() => btn.innerText = originalText, 1000);
        });
        
        btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 14px rgba(0,0,0,0.4)'; };
        btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)'; };

        panel.appendChild(btn);
        
        (document.body || document.documentElement).appendChild(panel);
        console.log('[WeLearn Helper] 面板已创建');
    };

    createPanel();
    
    window.addEventListener('load', createPanel);
    
    setInterval(() => {
        if (!document.getElementById('welearn-helper-panel')) {
            createPanel();
        }
    }, 1500);

})();