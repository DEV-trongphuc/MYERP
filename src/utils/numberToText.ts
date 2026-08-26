/**
 * Chuyển đổi số thành chữ tiếng Việt (hỗ trợ tối đa 9999 tỷ)
 */
export const numberToText = (number: number | string, currency: string = 'VND', showSuffix: boolean = true): string => {
  return numberToVietnameseText(number, currency, showSuffix);
};

export const numberToVietnameseText = (number: number | string, currency: string = 'VND', showSuffix: boolean = true): string => {
  if (number === "" || number === null || number === undefined) return "";
  
  const str = String(number).replace(/[^0-9]/g, "");
  const n = parseInt(str);
  
  if (isNaN(n) || n === 0) return "";
  if (n > 9999999999999) return "Số quá lớn (vượt quá 9999 tỷ)";

  const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

  const readThreeDigits = (num: number, isFirst: boolean): string => {
    const hundred = Math.floor(num / 100);
    const ten = Math.floor((num % 100) / 10);
    const single = num % 10;
    let res = "";

    if (hundred > 0 || !isFirst) {
      res += digits[hundred] + " trăm ";
    }

    if (ten > 0) {
      if (ten === 1) {
        res += "mười ";
      } else {
        res += digits[ten] + " mươi ";
      }
    } else if (hundred > 0 && single > 0) {
      res += "lẻ ";
    }

    if (single > 0) {
      if (single === 1 && ten > 1) {
        res += "mốt";
      } else if (single === 5 && ten > 0) {
        res += "lăm";
      } else if (single === 4 && ten > 1) {
        res += "tư";
      } else {
        res += digits[single];
      }
    }

    return res.trim();
  };

  let cleanNum = Math.floor(n);
  const groups: number[] = [];
  while (cleanNum > 0) {
    groups.push(cleanNum % 1000);
    cleanNum = Math.floor(cleanNum / 1000);
  }

  let result = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal === 0) {
      continue;
    }
    
    const isFirst = (i === groups.length - 1);
    const groupStr = readThreeDigits(groupVal, isFirst);
    
    const pos = i % 3;
    const billionGroup = Math.floor(i / 3);
    let unitName = units[pos];
    for (let j = 0; j < billionGroup; j++) {
      unitName += " tỷ";
    }
    
    result += groupStr + unitName + " ";
  }

  result = result.trim();
  if (!result) return "";
  
  result = result.charAt(0).toUpperCase() + result.slice(1);

  if (!showSuffix) return result;

  let suffix = "đồng";
  if (currency === 'USD') suffix = "đô la Mỹ";
  else if (currency === 'EURO') suffix = "Euro";
  else if (currency === 'CHF') suffix = "Franc Thụy Sĩ";
  
  return result + " " + suffix;
};
