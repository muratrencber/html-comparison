import { applyRemovals, compareTags, getTagComparisonData, parseRemovals, parseTags } from "./tag-comparison";
import { HtmlDiffer } from "html-differ";

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

const onCompare = () => {
    const tagExpressions = parseTags(tagsToCompare.value);
    const removals = parseRemovals(tagsToRemove.value);
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
        const parsedF1 = new DOMParser().parseFromString(f1c, 'text/html');
        const parsedF2 = new DOMParser().parseFromString(f2c, 'text/html');

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
        });

        console.log(tagResults);

        applyRemovals(parsedF1, removals, false);
        applyRemovals(parsedF2, removals, false);

        const f1t = parsedF1.documentElement.outerHTML;
        const f2t = parsedF2.documentElement.outerHTML;

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