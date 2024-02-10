const fs = require('fs');
const path = require('path');
const commander = require('commander');
const parser = require('@solidity-parser/parser');

commander
  .createCommand('solidity-graph-puml')
  .description('Generates PlantUML class diagrams from Solidity source code')
  .option(
    '-i, --input-path <path>',
    'Path to the folder containing .sol files',
    './contracts'
  )
  .option(
    '-o, --output-file <file>',
    'Name of the output .puml file (default: diagram.puml)',
    'diagram.puml'
  )
  .action((opts) => {
    const inputPath = opts.inputPath;
    const outputFile = opts.outputFile;
    generatePlantUMLMetadata(inputPath)
      .then(async (metadata) => {
        await fs.promises.writeFile(outputFile, metadata);
      })
      .catch((error) => {
        console.error('Error generating PlantUML diagram:', error);
      });
  })
  .parse(process.argv);

async function generatePlantUMLMetadata(inputPath) {
  const pumlMetadata = [];

  // Recursively read .sol files
  const readFiles = async (dirPath) => {
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        await readFiles(filePath);
      } else if (file.endsWith('.sol')) {
        try {
          const parsedAST = await parser.parse(
            fs.readFileSync(filePath, 'utf-8')
          );
          const classMetadata = extractClassMetadata(parsedAST);
          pumlMetadata.push(classMetadata);
        } catch (error) {
          console.error(`Error parsing ${filePath}:`, error);
        }
      }
    }
  };

  await readFiles(inputPath);
  return `@startuml
  ${pumlMetadata.join('\n')}
@enduml`;
}

function extractClassMetadata(parsedAST) {
  // Filter out the ContractDefinition
  const contractDefinitions = parsedAST.children.filter(
    (child) => child.type === 'ContractDefinition'
  );

  // map contract imports
  const imports = parsedAST.children
    .filter((child) => child.type === 'ImportDirective')
    .map((importDirective) => {
      return `import ${importDirective.path}`;
    });

  // Map the contract definitions to PlantUML class format
  const classes = contractDefinitions.map((contract) => {
    const className = contract.name;
    const classMembers = contract.subNodes
      .filter((node) => node.type === 'StateVariableDeclaration')
      .map(
        (variable) =>
          `${variable.variables[0].typeName.name} ${variable.variables[0].name}`
      );
    const classMethods = contract.subNodes
      .filter((node) => node.type === 'FunctionDefinition')
      .map(
        (func) =>
          `${func.name === null ? 'constructor' : func.name}(${func.parameters
            .map((param) => param.typeName.name)
            .join(', ')}) : ${
            func.returnParameters
              ? func.returnParameters
                  .map((param) => param.typeName.name)
                  .join(', ')
              : 'void'
          }`
      );

    return `class ${className} {
            ${imports.join('\n')}
            ${classMembers.join('\n')}
            ${classMethods.join('\n')}
        }`;
  });

  // Join the classes into a single PlantUML diagram
  // const puml = `@startuml
  //       ${classes.join('\n')}
  //   @enduml`;

  return classes.join('\n');
}
