'use client';

import React from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
    {
        question: "What is Blueprints?",
        answer: "Blueprints is an enterprise-grade AI agent launchpad. It allows you to deploy, manage, and scale autonomous agents (like OpenClaw, ZeroClaw, ElizaOS and more) with professional tools and a managed infrastructure layer."
    },
    {
        question: "Which AI models can I use?",
        answer: "You have complete freedom. Connect to Claude, GPT-4, or Gemini via API using our Managed Provider Keys (MPK) system, or host your own local models like Llama directly on your dedicated instance."
    },
    {
        question: "Is it secure?",
        answer: "Absolutely. Each Blueprint runs in an isolated container with tiered security models (Standard, Pro, Advanced). Your data stays within your dedicated environment, and keys are encrypted with AES-256."
    },
    {
        question: "Who handles the infrastructure?",
        answer: "We do. You don't need to worry about servers, Docker configurations, or maintenance. Blueprints is a fully managed platform where we handle the heavy lifting so you can focus on building your agents."
    },
    {
        question: "Are there other versions of OpenClaw available?",
        answer: (
            <>
                Yes! While this platform provides a fully managed experience, you can explore other Blueprint flavors and agent architectures at our community project: <a href="https://blueprints-frontend.vercel.app/" target="_blank" className="text-primary hover:underline font-bold">blueprints-frontend.vercel.app</a>. Choose the flavor that best fits your specific use case.
            </>
        )
    }
];

export function FAQ() {
    return (
        <section className="py-24 bg-white/[0.02]">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 italic uppercase">
                        Frequently Asked Questions
                    </h2>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <details
                            key={i}
                            className="group p-6 rounded-3xl bg-white/5 border border-white/10 open:border-primary/30 transition-all cursor-pointer"
                        >
                            <summary className="flex items-center justify-between list-none">
                                <h3 className="text-lg font-bold">{faq.question}</h3>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-open:rotate-180 transition-transform">
                                    <Plus size={18} className="group-open:hidden" />
                                    <Minus size={18} className="hidden group-open:block" />
                                </div>
                            </summary>
                            <div className="mt-4 text-muted-foreground leading-relaxed font-medium">
                                {faq.answer}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
