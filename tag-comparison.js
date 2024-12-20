/**
 * @typedef {Object} TagExpression
 * @property {string} cssSelector
 * @property {string[]} attributes
 */

/**
 * @typedef {Object} ElementRemoval
 * @property {boolean} immediate
 * @property {string} cssSelector
 * @property {string[]|undefined} attributes
 */

/**
 * @typedef {Object<string, string>} TagComparisonData
 */

/**
 * 
 * @param {string} str 
 * @returns {string[]}
 */
const getLines = (str) => str.split("\n").map(l => l.trim()).filter(l => l.length > 0);

/**
 * @param {string} tagsStr
 * @returns {TagExpression[]}
 */
export const parseTags = (tagsStr) => {
    const lines = getLines(tagsStr);
    /** @type {TagExpression[]} */
    const expressions = [];
    for(const line of lines)
    {
        const parts = line.split("=>");
        if(parts.length !== 2) continue;
        const [cssSelector, attributesStr] = parts.map(p => p.trim());
        if(!attributesStr.startsWith("[") || !attributesStr.endsWith("]")) continue;
        const attributes = attributesStr.slice(1, -1).split(",").map(a => a.trim());
        expressions.push({ cssSelector, attributes });
    }
    return expressions;
}

/**
 * @param {string} removalsStr
 * @returns {ElementRemoval[]} 
 */
export const parseRemovals = (removalsStr) => {
    const lines = getLines(removalsStr);
    /** @type {ElementRemoval[]} */
    const removals = [];
    for(const line of lines)
    {
        const parts = line.split("=>");
        if(parts.length !== 2 && parts.length !== 1) continue;
        const shouldRemoveAttributes = parts.length === 2;
        const cssSelectorAndImmediate = parts[0].trim();
        const isImmediate = cssSelectorAndImmediate.startsWith("!");
        const cssSelector = isImmediate ? cssSelectorAndImmediate.slice(1) : cssSelectorAndImmediate;
        /** @type {ElementRemoval} */
        const result = {
            immediate: isImmediate,
            cssSelector
        };
        if(shouldRemoveAttributes)
        {
            const attributesStr = parts[1].trim();
            if(!attributesStr.startsWith("[") || !attributesStr.endsWith("]")) continue;
            result.attributes = attributesStr.slice(1, -1).split(",").map(a => a.trim());
        }
        removals.push(result);
    }
    return removals;
}

/**
 * @typedef {Object} RemovalFlags
 * @property {boolean} fromClassList
 * @property {boolean} hasRegex
 * @property {string?} comparisonValue
 */

/**
 * 
 * @param {string} removalStr 
 * @returns {string?}
 */
const getRemovalComparisonValue = (removalStr) => {
    const eqSplitted = removalStr.split("=");
    if(eqSplitted.length !== 2) return null;
    return eqSplitted[1];
}

/**
 * 
 * @param {string} removalStr
 * @returns {RemovalFlags}
 */
const getRemovalFlags = (removalStr) => {
    const dcSplitted = removalStr.split(":");
    /** @type {RemovalFlags} */
    let currentFlags = {
        fromClassList: false,
        hasRegex: false,
        comparisonValue: getRemovalComparisonValue(removalStr)
    }
    if(dcSplitted.length !== 2) return currentFlags;
    const flags = dcSplitted[0];
    currentFlags.fromClassList = flags.includes("c");
    currentFlags.hasRegex = flags.includes("r");
    return currentFlags;
}

const stripRemovalFlagsAndComparison = (removalStr) => {
    if(removalStr.includes(":"))
        removalStr = removalStr.split(":")[1];
    if(removalStr.includes("="))
        removalStr = removalStr.split("=")[0];
    return removalStr;
}

/**
 * 
 * @param {string} removalStr 
 * @param {RemovalFlags} flags
 * @returns {(str: string) => boolean} 
 */
const getMatcher = (removalStr, flags) => {
    const stripped = stripRemovalFlagsAndComparison(removalStr);
    if(flags.hasRegex)
    {
        const regex = new RegExp(stripped, "i");
        return str => regex.test(str);
    }
    return str => str === stripped;
}

/**
 * 
 * @param {Document} document 
 * @param {ElementRemoval} removal 
 */
export const applyRemoval = (document, removal) => {
    const elements = document.querySelectorAll(removal.cssSelector);
    for(const element of elements)
    {
        if(removal.attributes)
        {
            for(const attribute of removal.attributes)
            {
                const flags = getRemovalFlags(attribute);
                const matcher = getMatcher(attribute, flags);
                if(flags.fromClassList)
                {
                    const classElements = element.classList;
                    const allElems = [];
                    const elementsToRemove = [];
                    classElements.forEach(className => {
                        allElems.push(className);
                        if(matcher(className)) elementsToRemove.push(className);
                    });
                    elementsToRemove.forEach(className => element.classList.remove(className));
                    continue;
                }
                const allAttributes = element.attributes;
                const attributesToRemove = [];
                for(const attr of allAttributes)
                {
                    if(matcher(attr.name) && (!flags.comparisonValue || flags.comparisonValue === attr.value))
                    {
                        attributesToRemove.push(attr.name);
                    }
                }
                attributesToRemove.forEach(attrName => element.removeAttribute(attrName));
            }
        }
        else
        {
            element.remove();
        }
    }
}

/**
 * 
 * @param {Document} document 
 * @param {TagExpression} comparison
 * @returns {TagComparisonData[]}
 */
export const getTagComparisonData = (document, comparison) => {
    const elements = document.querySelectorAll(comparison.cssSelector);
    /** @type {TagComparisonData[]} */
    const data = [];
    for(const element of elements)
    {
        const result = {};
        let hasMissingAttribute = false;
        for(const attribute of comparison.attributes)
        {
            const value = element.getAttribute(attribute);
            if(value === null)
            {
                hasMissingAttribute = true;
                break;
            }
            const trimmedValue = !!value ? value.trim() : null;
            result[attribute] = trimmedValue;
        }
        if(hasMissingAttribute) continue;
        data.push(result);
    }
    return data;
}

/**
 * 
 * @param {Object<string, string>} map1 
 * @param {Object<string, string>} map2
 * @returns {boolean} 
 */
const isAttributeMapsIdentical = (map1, map2) => {
    const keys1 = Object.keys(map1);
    const keys2 = Object.keys(map2);
    if(keys1.length !== keys2.length) return false;
    for(const key of keys1)
    {
        if(map1[key] !== map2[key]) return false;
    }
    return true;
}

/**
 * @param {TagComparisonData[]} tags1
 * @param {TagComparisonData[]} tags2
 * @returns {{
 *  onlyOn1: TagComparisonData[],
 *  onlyOn2: TagComparisonData[],
 * }}
 */
export const compareTags = (tags1, tags2) => {
    const onlyOn1 = tags1.filter(t1 => !tags2.find(t2 => isAttributeMapsIdentical(t1, t2)));
    const onlyOn2 = tags2.filter(t2 => !tags1.find(t1 => isAttributeMapsIdentical(t1, t2)));
    return { onlyOn1, onlyOn2 };
}

/**
 * 
 * @param {Document} document 
 * @param {ElementRemoval[]} removals 
 * @param {boolean} immediate 
 */
export const applyRemovals = (document, removals, immediate) => {
    const targetRemovals = removals.filter(r => r.immediate === immediate);
    for(const removal of targetRemovals)
    {
        applyRemoval(document, removal);
    }
}

/**
 * 
 * @param {TagExpression} data
 * @returns {string} 
 */
export const tagExpressionToString = (data) => {
    const attribs = "["+ data.attributes.join(", ") + "]";
    return `${data.cssSelector} => ${attribs}`;
}

/**
 * 
 * @param {ElementRemoval} data
 * @returns {string}  
 */
export const elementRemovalToString = (data) => {
    let res = "";
    if(data.immediate) res += "!";
    res += data.cssSelector;
    if(data.attributes)
        res += " => [" + data.attributes.join(", ") + "]";
    return res;
}