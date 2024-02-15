// CODE GENERATOR
//
// Invoke generate(program) with the program node to get back the JavaScript
// translation as a string.

import { StackInstruction } from './core.js'

export default function generate(program) {
  let programCounter = 0

  const variableName = (mapping => {
    return variable => {
      if (!mapping.has(variable)) {
        mapping.set(variable, mapping.size)
      }
      return mapping.get(variable)
    }
  })(new Map())

  const constName = (mapping => {
    return constant => {
      if (!mapping.has(constant)) {
        mapping.set(constant, mapping.size)
      }
      return mapping.get(constant)
    }
  })(new Map())

  const paramNames = new Map()

  const binaryOps = {
    '||': 0,
    '&&': 1,
    '<=': 2,
    '<': 3,
    '==': 4,
    '!=': 5,
    '>=': 6,
    '>': 7,
    '+': 8,
    '-': 9,
    '*': 10,
    '/': 11,
    '%': 12,
    '**': 13,
  }

  const stdLib = {
    print: 0,
    sqrt: 1,
    sin: 2,
    cos: 3,
    exp: 4,
    ln: 5,
    hypot: 6,
  }

  const output = []

  const gen = node => generators[node.constructor.name](node)

  const generators = {
    Program(p) {
      gen(p.statements)
    },
    VariableDeclaration(d) {
      gen(d.initializer)
      output.push(
        new StackInstruction(programCounter++, 'STORE_NAME', variableName(d.variable.name), d.variable.name)
      )
    },
    Variable(v) {
      if (paramNames.has(v.name)) {
        output.push(
          new StackInstruction(programCounter++, 'LOAD_FAST', paramNames.get(v.name), v.name)
        )
      } else {
        output.push(
          new StackInstruction(programCounter++, 'LOAD_NAME', variableName(v.name), v.name)
        )
      }
    },
    FunctionDeclaration(d) {
      output.push(new StackInstruction(programCounter++, 'MAKE_FUNCTION'))

      d.params.forEach(param => {
        paramNames.set(param.name, paramNames.size)
      })

      gen(d.body)
      output.push(new StackInstruction(programCounter++, 'STORE_NAME', variableName(d.fun.name), d.fun.name))

      paramNames.clear()
    },
    Function(f) {
      if (paramNames.has(f.name)) {
        output.push(
          new StackInstruction(programCounter++, 'LOAD_FAST', paramNames.get(f.name), f.name)
        )
      } else {
        output.push(
          new StackInstruction(
            programCounter++,
            'LOAD_NAME',
            stdLib[f.name] ?? variableName(f.name),
            f.name
          )
        )
      }
    },
    PrintStatement(s) {
      gen(s.argument)
      output.push(
        new StackInstruction(programCounter++, 'CALL_STDLIB', stdLib['print'], 'print')
      )
    },
    Assignment(s) {
      gen(s.source)
      output.push(
        new StackInstruction(programCounter++, 'STORE_NAME', variableName(s.target.name), s.target.name)
      )
    },
    WhileStatement(s) {
      const testIndex = programCounter
      gen(s.test)
      const jumpInstructionIndex = programCounter++
      gen(s.body)
      output.push(new StackInstruction(programCounter++, 'JUMP', testIndex))
      output.splice(
        jumpInstructionIndex,
        0,
        new StackInstruction(jumpInstructionIndex, 'JUMP_IF_FALSE', programCounter)
      )
    },
    Call(c) {
      if (paramNames.has(c.callee.name)) {
        output.push(
          new StackInstruction(programCounter++, 'LOAD_FAST', paramNames.get(c.callee.name), c.callee.name)
        )
      } else {
        output.push(
          new StackInstruction(programCounter++, 'LOAD_NAME', variableName(c.callee.name), c.callee.name)
        )
      }

      c.args.forEach(gen)
      output.push(new StackInstruction(programCounter++, 'CALL'))
    },
    Conditional(e) {
      gen(e.test)
      const alternateStart = programCounter++
      gen(e.consequent)
      const consequentStart = programCounter++
      gen(e.alternate)

      output.splice(
        alternateStart,
        0,
        new StackInstruction(alternateStart, 'JUMP_IF_FALSE', consequentStart + 1)
      )
      output.splice(
        consequentStart,
        0,
        new StackInstruction(consequentStart, 'JUMP', programCounter)
      )
    },
    BinaryExpression(e) {
      gen(e.left)
      gen(e.right)
      output.push(new StackInstruction(programCounter++, 'BINARY_OP', binaryOps[e.op], e.op))
    },
    UnaryExpression(e) {
      gen(e.operand)
      output.push(
        new StackInstruction(programCounter++, `UNARY_${e.op === '!' ? 'NOT' : 'NEGATIVE'}`)
      )
    },
    Number(e) {
      output.push(new StackInstruction(programCounter++, 'LOAD_CONST', constName(e), e))
    },
    Boolean(e) {
      output.push(new StackInstruction(programCounter++, 'LOAD_CONST', constName(e), e))
    },
    Array(a) {
      return a.map(gen)
    },
  }

  gen(program)
  return output
}
