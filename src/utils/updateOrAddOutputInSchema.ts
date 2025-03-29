import fs from "fs";

export const updateOrAddOutputInSchema = (filePath: string, newOutputValue: string) => {
  const schemaContent = fs.readFileSync(filePath, "utf-8");

  const generatorRegex = /generator\s+client\s*\{([^}]+)\}/gims;
  const generatorMatch = schemaContent.match(generatorRegex);

  if (!generatorMatch) {
    throw new Error(`The generator block was not found in schema file: ${filePath}`);
  }

  const updatedSchema = schemaContent.replace(generatorRegex, (block) => {
    let outputFound = false;
    let inBlockComment = false;

    const processedLines: string[] = [];
    const lines = block.split("\n");

    for (const line of lines) {
      let currentLine = line;
      let codePart = "";
      let commentStart = Infinity;

      if (inBlockComment) {
        const endBlockIndex = currentLine.indexOf("*/");
        if (endBlockIndex !== -1) {
          inBlockComment = false;
          currentLine = currentLine.slice(endBlockIndex + 2);
        } else {
          processedLines.push(line);
          continue;
        }
      }

      const startBlockIndex = currentLine.indexOf("/*");
      if (startBlockIndex !== -1) {
        inBlockComment = true;
        codePart = currentLine.slice(0, startBlockIndex);
        commentStart = startBlockIndex;
      } else {
        codePart = currentLine;
      }

      const lineComments = [/\/\//g, /#/g].map((re) => re.exec(codePart));
      const earliestComment = lineComments
        .filter((match) => match)
        .sort((a, b) => a!.index - b!.index)[0];

      if (earliestComment) {
        codePart = codePart.slice(0, earliestComment.index);
        commentStart = Math.min(commentStart, earliestComment.index);
      }

      const outputMatch = codePart.match(/^\s*output\s*=\s*(["']).*?\1/ims);
      if (outputMatch) {
        outputFound = true;
        const newLine = line.replace(
          /(\s*output\s*=\s*["'])(.*?)(["'])/ims,
          `$1${newOutputValue}$3`,
        );
        processedLines.push(newLine);
        continue;
      }

      processedLines.push(line);
    }

    if (!outputFound) {
      const insertPosition = processedLines.findIndex((l) => l.includes("{")) + 1;
      processedLines.splice(insertPosition, 0, `  output = "${newOutputValue}"`);
    }

    return processedLines.join("\n");
  });

  fs.writeFileSync(filePath, updatedSchema, "utf-8");
};
