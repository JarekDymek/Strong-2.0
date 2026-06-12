// Plik: js/focusMode.js
// Cel: Cała logika Trybu Skupienia.

import { getActiveCompetitors, getCompetitorProfile, getFocusModeIndex, setFocusModeIndex } from './state.js';
import { DOMElements } from './ui.js';
import { saveToUndoHistory } from './history.js';
import { triggerAutoSave } from './persistence.js';
import { getState } from './state.js';

export function setupFocusModeEventListeners() {
    document.getElementById('closeFocusBtn').addEventListener('click', handleCloseFocusMode);
    document.getElementById('focusPrevBtn').addEventListener('click', () => handleFocusNavigate(-1));
    document.getElementById('focusNextBtn').addEventListener('click', () => handleFocusNavigate(1));
    document.getElementById('focusConfirmNextBtn').addEventListener('click', handleFocusConfirmAndNext);
    document.getElementById('focusAwardPointsBtn').addEventListener('click', handleFocusAwardPoints);
    DOMElements.focusResultInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleFocusConfirmAndNext();
        }
    });
}

export function handleEnterFocusMode(competitorName) {
    const competitors = getActiveCompetitors();
    const index = competitors.findIndex(c => c === competitorName);
    if (index === -1) return;
    
    setFocusModeIndex(index);
    renderFocusMode();
    DOMElements.focusModeModal.classList.add('visible');
    DOMElements.focusResultInput.focus();
    DOMElements.focusResultInput.select();
}

function renderFocusMode() {
    const focusModeIndex = getFocusModeIndex();
    if (focusModeIndex === -1) return;

    const competitors = getActiveCompetitors();
    const competitorName = competitors[focusModeIndex];
    const profile = getCompetitorProfile(competitorName) || {};
    const resultInput = document.querySelector(`#resultsTable .resultInput[data-name="${CSS.escape(competitorName)}"]`);
    const confirmBtn = document.getElementById('focusConfirmNextBtn');

    DOMElements.focusCompetitorName.textContent = competitorName;
    DOMElements.focusCompetitorPhoto.src = profile.photo || 'https://placehold.co/120x120/eee/333?text=?';
    DOMElements.focusResultInput.value = resultInput ? resultInput.value : '';

    const isLastCompetitor = focusModeIndex === competitors.length - 1;
    document.getElementById('focusPrevBtn').disabled = focusModeIndex === 0;
    document.getElementById('focusNextBtn').disabled = isLastCompetitor;

    // POPRAWKA: na ostatnim zawodniku pokaż dodatkowy, dobrze widoczny przycisk,
    // który zapisuje wynik, zamyka Tryb Skupienia, wraca do ekranu głównego
    // i od razu przyznaje punkty — kluczowe w wersji na smartfona.
    const awardBtn = document.getElementById('focusAwardPointsBtn');
    if (awardBtn) {
        awardBtn.style.display = isLastCompetitor ? 'block' : 'none';
    }

    if (isLastCompetitor) {
        confirmBtn.textContent = 'Zatwierdź i Zamknij';
    } else {
        confirmBtn.textContent = 'Zatwierdź i Następny';
    }
}

function handleCloseFocusMode() {
    DOMElements.focusModeModal.classList.remove('visible');
    setFocusModeIndex(-1);

    // POPRAWKA: po zamknięciu Trybu Skupienia (zwłaszcza po ostatnim zawodniku)
    // odśwież podświetlenie kolejnego kroku ("Przyznaj Punkty" / "Następna Konkurencja")
    // i przewiń ekran tak, aby te przyciski były widoczne na smartfonie.
    document.dispatchEvent(new CustomEvent('strongman:result-updated'));

    setTimeout(() => {
        const actionsBar = document.querySelector('.workflow-actions') || document.getElementById('calculatePointsBtn');
        if (actionsBar) {
            actionsBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
}

function handleFocusNavigate(direction) {
    const newIndex = getFocusModeIndex() + direction;
    const competitors = getActiveCompetitors();
    if (newIndex >= 0 && newIndex < competitors.length) {
        setFocusModeIndex(newIndex);
        renderFocusMode();
        DOMElements.focusResultInput.focus();
        DOMElements.focusResultInput.select();
    }
}

/**
 * Zapisuje wynik z Trybu Skupienia do głównej tabeli wyników (jeśli się zmienił).
 * Zwraca true, jeśli doszło do zapisu.
 */
function saveCurrentFocusResult() {
    const focusModeIndex = getFocusModeIndex();
    if (focusModeIndex === -1) return false;

    const competitorName = getActiveCompetitors()[focusModeIndex];
    const mainTableInput = document.querySelector(`#resultsTable .resultInput[data-name="${CSS.escape(competitorName)}"]`);
    if (mainTableInput) {
        const newResult = DOMElements.focusResultInput.value;
        if (mainTableInput.value !== newResult) {
            saveToUndoHistory(getState());
            mainTableInput.value = newResult;
            triggerAutoSave();
            // POPRAWKA: poinformuj resztę aplikacji (m.in. przewodnik kolejnych
            // kroków "Przyznaj Punkty" / "Następna Konkurencja"), że wynik się zmienił.
            document.dispatchEvent(new CustomEvent('strongman:result-updated'));
            return true;
        }
    }
    return false;
}

function handleFocusConfirmAndNext() {
    saveCurrentFocusResult();

    const isLastCompetitor = getFocusModeIndex() === getActiveCompetitors().length - 1;
    if (isLastCompetitor) {
        handleCloseFocusMode();
    } else {
        handleFocusNavigate(1);
    }
}

/**
 * POPRAWKA: Przycisk dostępny na ostatnim zawodniku w Trybie Skupienia.
 * Zapisuje ostatni wynik, zamyka Tryb Skupienia (wracając do ekranu głównego)
 * i od razu zleca przyznanie punktów dla bieżącej konkurencji.
 */
function handleFocusAwardPoints() {
    saveCurrentFocusResult();
    handleCloseFocusMode();
    document.dispatchEvent(new CustomEvent('strongman:request-calculate-points'));
}
