import { applyRemovals, compareTags, getTagComparisonData, parseRemovals, parseTags, tagExpressionToString } from "./tag-comparison";
import { HtmlDiffer } from "html-differ";
import { unescape } from 'he';

const compareButton = document.getElementById('btn-compare');
const tagsToCompare = document.getElementById('tags-to-compare');
const tagsToRemove = document.getElementById('tags-to-remove');
/** @type {HTMLInputElement} */
const file1Input = document.getElementById('file1');
const file2Input = document.getElementById('file2');
const file1Diff = document.getElementById('file1-diff');
const file2Diff = document.getElementById('file2-diff');
const tagComparisonResult1 = document.getElementById('tag-comparison-result-1');
const tagComparisonResult2 = document.getElementById('tag-comparison-result-2');

const refreshOptions = () => {
    /**
     * 
     * @param {string} id 
     * @returns {boolean}
     */
    const gcbv = (id) => document.getElementById(id)?.checked ?? false;
    return {
        rmEmptyParas: gcbv('remove-empty-paragraphs'),
        repSpecial: gcbv('replace-special'),
        ignImgSrc: gcbv('ignore-image-sources'),
        ignImgAlt: gcbv('ignore-image-alts'),
        ignBlankA: gcbv('ignore-a-blank'),
        ignRelA: gcbv('ignore-a-rels')
    }
}

/** @type {File} */
let file1 = null;
/** @type {File} */
let file2 = null;
file1Input.files = undefined;
file2Input.files = undefined;

let uploadingFiles = false;

const refreshCompareButton = () => {
    file1 = file1Input.files?.[0];
    file2 = file2Input.files?.[0];
    compareButton.disabled = (!file1 && !file2) || uploadingFiles;
}

const createOneCharString = (len, char) => {
    let res = "";
    for(let i = 0; i < len; i++)
        res += char;
    return res;
}

file1Input.addEventListener('change', refreshCompareButton);
file2Input.addEventListener('change', refreshCompareButton);

refreshCompareButton();

/**
 * 
 * @param {HTMLElement} parent
 * @param {{
 * childContainer: HTMLElement,
 * header: HTMLElement}} 
 */
const addComparisonResult = (parent) => {
    const mainContainer = document.createElement('div');
    mainContainer.classList.add('tag-comparison-result-entry');
    const header = document.createElement('div');
    header.classList.add('entry-header');
    const childContainer = document.createElement('div');
    childContainer.classList.add('entries');
    mainContainer.appendChild(header);
    mainContainer.appendChild(childContainer);
    parent.appendChild(mainContainer);
    return { header, childContainer };
}

/**
 * 
 * @param {import("./tag-comparison").TagComparisonData} comparisonData
 * @returns {HTMLElement} 
 */
const createComparisonEntry = (comparisonData) => {
    const container = document.createElement('div');
    container.classList.add('tag-comparison-entry');
    const attrMapToString = Object.entries(comparisonData).sort((a, b) => {
        return a[0].localeCompare(b[0]);
    }).map(([key, value]) => `${key}="${value}"`).join(' ');
    container.innerText = `<${attrMapToString}>`;
    return container;
}

/**
 * 
 * @param {{
 * expression: import("./tag-comparison").TagExpression,
 * comparisonResult: {
 * onlyOn1: import("./tag-comparison").TagComparisonData[],
 * onlyOn2: import("./tag-comparison").TagComparisonData[]
 * }
 * }} result 
 */
const applyTagResult = (result) => {
    const elems1 = addComparisonResult(tagComparisonResult1);
    const elems2 = addComparisonResult(tagComparisonResult2);
    elems1.header.innerText = tagExpressionToString(result.expression);
    elems2.header.innerText = tagExpressionToString(result.expression);

    /**
     * 
     * @param {import("./tag-comparison").TagComparisonData} td 
     * @param {boolean} is1
     * @returns {[import("./tag-comparison").TagComparisonData, boolean]}
     */
    const mapTComp = (td, is1) => {
        return [td, is1];
    }
    /**
     * 
     * @param {import("./tag-comparison").TagComparisonData[]} tds 
     * @param {boolean} is1 
     * @returns {[import("./tag-comparison").TagComparisonData, boolean][]}
     */
    const mapTCompArray = (tds, is1) => tds.map(td => mapTComp(td, is1));
    const allElems = [
        ...mapTCompArray(result.comparisonResult.onlyOn1, true),
        ...mapTCompArray(result.comparisonResult.onlyOn2, false)
    ]
    for(const [td, is1] of allElems)
    {
        const t1Entry = createComparisonEntry(td);
        t1Entry.classList.add(is1 ? "added" : "removed");
        const t2Entry = createComparisonEntry(td);
        t2Entry.classList.add(is1 ? "removed" : "added");
        elems1.childContainer.appendChild(t1Entry);
        elems2.childContainer.appendChild(t2Entry);
    }
}

const onCompare = () => {
    const options = refreshOptions();
    const tagExpressions = parseTags(tagsToCompare.value);
    const removals = parseRemovals(`${tagsToRemove.value}${options.ignRelA ? "\n!a => [rel]" : ""}${options.ignBlankA ? "\n!a => [target=_blank]" : ""}${options.ignImgAlt ? "\n!img => [alt]" : ""}${options.ignImgSrc ? "\n!img => [src,data-src]" : ""}`);
    file1Diff.innerHTML = '';
    file2Diff.innerHTML = '';
    tagComparisonResult1.innerHTML = '';
    tagComparisonResult2.innerHTML = '';

    const asyncFileOp = async () => {
        const file1Content = await file1.text();
        const file2Content = await file2.text();
        return [file1Content, file2Content];
    }
    uploadingFiles = true;
    compareButton.disabled = true;
    asyncFileOp().then(([f1c, f2c]) => {

        const styleFormatter = (elem) => {
            let styleText = elem.getAttribute('style');
            if(!styleText) return;
            let trimmed = styleText.trim();
            if(!trimmed.endsWith(';'))
                trimmed += ';';
            elem.setAttribute('style', trimmed);
        }

        const removeEmptyParagraphs = (p) => {
            if(p.textContent.trim().length === 0)
                p.remove();
            else if(p.children.length === 1 && p.children[0].tagName.toLowerCase() === 'p')
                p.outerHTML = p.innerHTML;
        }

        const parsedF1 = new DOMParser().parseFromString(f1c, 'text/html');
        const parsedF2 = new DOMParser().parseFromString(f2c, 'text/html');
        parsedF1.querySelectorAll("[style]").forEach(styleFormatter);
        parsedF2.querySelectorAll("[style]").forEach(styleFormatter);
        if(options.rmEmptyParas)
        {
            parsedF1.querySelectorAll("p").forEach(removeEmptyParagraphs);
            parsedF2.querySelectorAll("p").forEach(removeEmptyParagraphs);
        }

        applyRemovals(parsedF1, removals, true);
        applyRemovals(parsedF2, removals, true);

        const p1TagData = tagExpressions.map(te => ({
            expression: te,
            comparisonData: getTagComparisonData(parsedF1, te)
        }));
        const p2TagData = tagExpressions.map(te => ({
            expression: te,
            comparisonData: getTagComparisonData(parsedF2, te)
        }));
        const tagResults = tagExpressions.map((te, i) => {
            const p1td = p1TagData[i];
            const p2td = p2TagData[i];
            const comparisonResult = compareTags(p1td.comparisonData, p2td.comparisonData);
            return {
                expression: te,
                comparisonResult
            };
        }).filter(
            result => result.comparisonResult.onlyOn1.length > 0 || result.comparisonResult.onlyOn2.length > 0
        );

        tagComparisonResult1.innerHTML = '';
        tagComparisonResult2.innerHTML = '';
        tagResults.forEach(applyTagResult);

        applyRemovals(parsedF1, removals, false);
        applyRemovals(parsedF2, removals, false);

        unescape.options.isAttributeValue = false;
        unescape.options.strict = false;

        /**
         * 
         * @param {string} htmlStr
         * @returns {string} 
         */
        const ue = (htmlStr) => {
            if(!options.repSpecial) return htmlStr;
            const replacements = [
                ["\"", "“"],
                ["\"", "”"],
                ["'", "’"],
            ];
            let res = htmlStr;
            for(const [to, from] of replacements)
                res = res.replaceAll(from, to);
            return res;
        }

        const f1t = ue(parsedF1.documentElement.outerHTML);
        const f2t = ue(parsedF2.documentElement.outerHTML);

        const differ = new HtmlDiffer({ ignoreAttributes: [] });
        const diffs = differ.diffHtml(f1t, f2t);
        for(const diff of diffs)
        {
            const isCommon = !diff.added && !diff.removed;
            const isF1 = !!diff.removed;
            const isF2 = !!diff.added;
            if(isCommon)
            {
                const elem = document.createElement('span');
                elem.className = "common";
                elem.innerText = diff.value;
                file1Diff.appendChild(elem);
                file2Diff.appendChild(elem.cloneNode(true));
            }
            else
            {
                const f1Elem = document.createElement('span');
                const f2Elem = document.createElement('span');
                f1Elem.className = "removed";
                f2Elem.className = "added";
                const f1Content = isF1 ? diff.value : createOneCharString(diff.value.trim().length,"*");
                const f2Content = isF2 ? diff.value : createOneCharString(diff.value.trim().length,"*");
                f1Elem.innerText = f1Content;
                f2Elem.innerText = f2Content;
                file1Diff.appendChild(f1Elem);
                file2Diff.appendChild(f2Elem);
            }
        }
    }).finally(() => {
        uploadingFiles = false;
        refreshCompareButton();
    });
}

compareButton.addEventListener('click', onCompare);